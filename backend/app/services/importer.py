import hashlib
import io
import json
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Optional

import pandas as pd
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.import_batch import ImportBatch, RawImportRow
from app.models.trade import Trade
from app.services.fee import calc_fee


REQUIRED_COLUMNS = {
    "成交日期", "证券代码", "证券名称", "买卖标志",
    "成交价格", "成交数量", "成交金额", "交易市场", "摘要",
}

SIDE_MAP = {
    "证券买入": "buy",
    "买入": "buy",
    "证券卖出": "sell",
    "卖出": "sell",
    "担保品划入": "transfer_in",
}

MARKET_MAP = {
    "深Ａ": "SZ", "深A": "SZ",
    "沪Ａ": "SH", "沪A": "SH",
    "深": "SZ", "沪": "SH",
}


@dataclass
class ImportResult:
    batch_id: int
    inserted: int
    skipped_dup: int
    failed: list[dict] = field(default_factory=list)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _parse_date_from_filename(filename: str) -> tuple[Optional[date], Optional[date]]:
    m = re.search(r"(\d{8})_(\d{8})", filename)
    if m:
        try:
            s = date(int(m.group(1)[:4]), int(m.group(1)[4:6]), int(m.group(1)[6:8]))
            e = date(int(m.group(2)[:4]), int(m.group(2)[4:6]), int(m.group(2)[6:8]))
            return s, e
        except ValueError:
            pass
    return None, None


def _normalize_market(raw: str) -> str:
    raw = raw.strip()
    for k, v in MARKET_MAP.items():
        if k in raw:
            return v
    return raw[:2].upper()


def _load_dataframe(content: bytes) -> pd.DataFrame:
    text = content.decode("utf-8", errors="ignore").lower()
    if "<table" in text or "<html" in text:
        dfs = pd.read_html(io.BytesIO(content))
        if dfs:
            return dfs[0].astype(str)
        raise ValueError("No table found in HTML content")

    raw_text = content.decode("gb18030", errors="replace")
    lines = raw_text.splitlines()
    rows = []
    for line in lines:
        cols = line.split("\t")
        rows.append(cols)
    if not rows:
        raise ValueError("Empty file")

    # Determine header (strip empty trailing cols)
    header = [c.strip() for c in rows[0]]
    while header and header[-1] == "":
        header.pop()
    n_cols = len(header)

    # Pad or truncate each data row to match header width
    data = []
    for row in rows[1:]:
        row = list(row)
        if len(row) < n_cols:
            row += [""] * (n_cols - len(row))
        data.append(row[:n_cols])

    df = pd.DataFrame(data, columns=header)
    return df.astype(str)


def import_file(db: Session, filename: str, content: bytes, account_id: int) -> ImportResult:
    file_hash = _sha256(content)

    existing = db.query(ImportBatch).filter(
        ImportBatch.account_id == account_id,
        ImportBatch.file_hash == file_hash,
    ).first()
    if existing:
        raise ValueError(f"文件已导入（批次 ID={existing.id}）")

    df = _load_dataframe(content)
    df.columns = [c.strip() for c in df.columns]

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"缺少列：{missing}")

    batch = ImportBatch(account_id=account_id, filename=filename, file_hash=file_hash, row_count=0)
    db.add(batch)
    db.flush()

    inserted = 0
    skipped_dup = 0
    failed: list[dict] = []

    trade_dates: list[date] = []

    for idx, row in df.iterrows():
        row_no = int(idx) + 2
        raw_text = "\t".join(str(v) for v in row.values)

        raw_row = RawImportRow(
            import_batch_id=batch.id,
            row_no=row_no,
            raw_text=raw_text,
            parsed=False,
        )
        db.add(raw_row)
        db.flush()

        try:
            trade = _parse_row(row, raw_row.id, batch.id, account_id)
        except Exception as e:
            raw_row.error = str(e)
            failed.append({"row_no": row_no, "raw_text": raw_text, "error": str(e)})
            db.flush()
            continue

        try:
            db.add(trade)
            db.flush()
            raw_row.parsed = True
            inserted += 1
            trade_dates.append(trade.trade_date)
        except IntegrityError:
            db.rollback()
            # Re-add the raw_row after rollback wipes it
            raw_row2 = RawImportRow(
                import_batch_id=batch.id,
                row_no=row_no,
                raw_text=raw_text,
                parsed=False,
                error="duplicate",
            )
            db.add(raw_row2)
            db.flush()
            skipped_dup += 1

    period_start, period_end = _parse_date_from_filename(filename)
    if trade_dates:
        if period_start is None:
            period_start = min(trade_dates)
        if period_end is None:
            period_end = max(trade_dates)

    batch.row_count = inserted + skipped_dup + len(failed)
    batch.period_start = period_start
    batch.period_end = period_end

    db.commit()

    # 行情不在导入时自动拉取；由首页「拉取最新行情」/设置「全量历史」按钮触发。
    return ImportResult(batch_id=batch.id, inserted=inserted, skipped_dup=skipped_dup, failed=failed)


def _parse_row(row: "pd.Series", raw_row_id: int, batch_id: int, account_id: int) -> Trade:
    date_str = str(row["成交日期"]).strip()
    if len(date_str) == 8:
        td = date(int(date_str[:4]), int(date_str[4:6]), int(date_str[6:8]))
    else:
        raise ValueError(f"无法解析日期：{date_str}")

    stock_code = str(row["证券代码"]).strip().lstrip("'").zfill(6)
    stock_name = str(row["证券名称"]).strip()

    side_raw = str(row["买卖标志"]).strip()
    side = None
    for k, v in SIDE_MAP.items():
        if k in side_raw:
            side = v
            break
    if side is None:
        raise ValueError(f"未知买卖标志：{side_raw}")

    price = Decimal(str(row["成交价格"]).strip().replace(",", ""))
    quantity = int(str(row["成交数量"]).strip().replace(",", ""))
    amount = Decimal(str(row["成交金额"]).strip().replace(",", ""))

    market_raw = str(row["交易市场"]).strip()
    market = _normalize_market(market_raw)
    ts_code = f"{stock_code}.{market}"

    remark_col = "摘要" if "摘要" in row.index else None
    remark = str(row[remark_col]).strip() if remark_col and str(row[remark_col]).strip() not in ("nan", "") else None

    fee = calc_fee(side, market, amount)

    return Trade(
        account_id=account_id,
        trade_date=td,
        seq=0,
        ts_code=ts_code,
        stock_code=stock_code,
        stock_name=stock_name,
        side=side,
        price=price,
        quantity=quantity,
        amount=amount,
        fee=fee,
        market=market,
        source="ths_xls",
        remark=remark,
        raw_row_id=raw_row_id,
        import_batch_id=batch_id,
    )
