import hashlib
import io
import json
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Optional, Sequence

import pandas as pd
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.import_batch import ImportBatch, RawImportRow
from app.models.trade import Trade
from app.services.fee import calc_fee, get_fee_config


REQUIRED_FIELDS = (
    "成交日期", "证券代码", "证券名称", "买卖标志",
    "成交价格", "成交数量", "成交金额",
)


@dataclass(frozen=True)
class ImportAdapter:
    id: str
    name: str
    columns: dict[str, Sequence[str]]


IMPORT_ADAPTERS = (
    ImportAdapter(
        id="ths_standard",
        name="同花顺标准成交导出",
        columns={
            "成交日期": ("成交日期",),
            "证券代码": ("证券代码",),
            "证券名称": ("证券名称",),
            "买卖标志": ("买卖标志",),
            "成交价格": ("成交价格",),
            "成交数量": ("成交数量",),
            "成交金额": ("成交金额",),
            "交易市场": ("交易市场",),
            "摘要": ("摘要",),
            "成交时间": ("成交时间",),
        },
    ),
    ImportAdapter(
        id="ths_contract_export",
        name="同花顺合同编号成交导出",
        columns={
            "成交日期": ("成交日期", "交易日期"),
            "证券代码": ("证券代码", "股票代码"),
            "证券名称": ("证券名称", "股票名称"),
            "买卖标志": ("操作",),
            "成交价格": ("成交均价",),
            "成交数量": ("成交数量",),
            "成交金额": ("成交金额",),
            "交易市场": ("交易市场",),
            "摘要": ("摘要", "备注"),
            "成交时间": ("成交时间",),
        },
    ),
)

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
    "京Ａ": "BJ", "京A": "BJ", "北交所": "BJ", "京": "BJ",
}


@dataclass
class ImportResult:
    batch_id: int
    inserted: int
    skipped_dup: int
    failed: list[dict] = field(default_factory=list)


class ImportSchemaError(ValueError):
    pass


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


def _infer_market(stock_code: str) -> str:
    if stock_code.startswith("6"):
        return "SH"
    if stock_code.startswith(("0", "2", "3")):
        return "SZ"
    if stock_code.startswith(("4", "8", "9")):
        return "BJ"
    raise ValueError(f"无法从证券代码推断交易市场：{stock_code}")


def _column_key(name: str) -> str:
    normalized = unicodedata.normalize("NFKC", str(name)).lower()
    return re.sub(r"[\s:_\-—/\\()（）【】\[\]{}]+", "", normalized)


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


def _match_adapter(headers: Sequence[str], adapter: ImportAdapter) -> tuple[dict[str, str], set[str]]:
    header_by_key = {_column_key(header): header for header in headers}
    mapping: dict[str, str] = {}
    missing: set[str] = set()

    for target, accepted_headers in adapter.columns.items():
        source = next(
            (header_by_key[_column_key(header)] for header in accepted_headers if _column_key(header) in header_by_key),
            None,
        )
        if source:
            mapping[source] = target
        elif target in REQUIRED_FIELDS:
            missing.add(target)

    return mapping, missing


def _select_adapter(headers: Sequence[str]) -> tuple[ImportAdapter, dict[str, str]]:
    failures: list[tuple[ImportAdapter, set[str]]] = []
    for adapter in IMPORT_ADAPTERS:
        mapping, missing = _match_adapter(headers, adapter)
        if not missing:
            return adapter, mapping
        failures.append((adapter, missing))

    best_adapter, missing = min(failures, key=lambda item: len(item[1]))
    missing_text = "、".join(sorted(missing))
    header_text = "、".join(str(header).strip() for header in headers if str(header).strip())
    raise ImportSchemaError(
        f"暂不支持该文件格式，最接近「{best_adapter.name}」，但缺少必需字段：{missing_text}。"
        f"检测到表头：{header_text}。请使用已支持的券商导出模板，或后续通过字段映射预览手动指定。"
    )


def _apply_adapter(df: pd.DataFrame) -> tuple[pd.DataFrame, ImportAdapter]:
    df = df.copy()
    df.columns = [str(column).strip() for column in df.columns]
    adapter, mapping = _select_adapter(df.columns)
    df = df.rename(columns=mapping)
    return df, adapter


def import_file(db: Session, filename: str, content: bytes, account_id: int) -> ImportResult:
    file_hash = _sha256(content)

    existing = db.query(ImportBatch).filter(
        ImportBatch.account_id == account_id,
        ImportBatch.file_hash == file_hash,
    ).first()
    if existing:
        raise ValueError(f"文件已导入（批次 ID={existing.id}）")

    df, adapter = _apply_adapter(_load_dataframe(content))

    batch = ImportBatch(account_id=account_id, filename=filename, file_hash=file_hash, row_count=0)
    db.add(batch)
    db.flush()

    inserted = 0
    skipped_dup = 0
    failed: list[dict] = []

    trade_dates: list[date] = []
    fee_config = get_fee_config(db, account_id)

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
            trade = _parse_row(
                row,
                raw_row.id,
                batch.id,
                account_id,
                fee_config.commission_rate,
                fee_config.commission_min_fee_exempt,
                adapter.id,
            )
        except Exception as e:
            raw_row.error = str(e)
            failed.append({"row_no": row_no, "raw_text": raw_text, "error": str(e)})
            db.flush()
            continue

        duplicate = _find_duplicate_trade(db, trade)
        if duplicate:
            if not duplicate.trade_time and trade.trade_time:
                duplicate.trade_time = trade.trade_time
            raw_row.error = "duplicate"
            skipped_dup += 1
            db.flush()
            continue

        try:
            with db.begin_nested():
                db.add(trade)
                db.flush()
            raw_row.parsed = True
            inserted += 1
            trade_dates.append(trade.trade_date)
        except IntegrityError:
            raw_row.error = "duplicate"
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


def _find_duplicate_trade(db: Session, trade: Trade) -> Optional[Trade]:
    exact = db.query(Trade).filter(
        Trade.account_id == trade.account_id,
        Trade.trade_date == trade.trade_date,
        Trade.trade_time == trade.trade_time,
        Trade.stock_code == trade.stock_code,
        Trade.side == trade.side,
        Trade.price == trade.price,
        Trade.quantity == trade.quantity,
        Trade.amount == trade.amount,
    ).first()
    if exact:
        return exact

    if trade.trade_time:
        return db.query(Trade).filter(
            Trade.account_id == trade.account_id,
            Trade.trade_date == trade.trade_date,
            Trade.trade_time == "",
            Trade.stock_code == trade.stock_code,
            Trade.side == trade.side,
            Trade.price == trade.price,
            Trade.quantity == trade.quantity,
            Trade.amount == trade.amount,
        ).first()

    return None


def _parse_row(
    row: "pd.Series",
    raw_row_id: int,
    batch_id: int,
    account_id: int,
    commission_rate: Decimal,
    commission_min_fee_exempt: bool,
    source: str,
) -> Trade:
    date_str = str(row["成交日期"]).strip()
    if len(date_str) == 8:
        td = date(int(date_str[:4]), int(date_str[4:6]), int(date_str[6:8]))
    elif re.match(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}$", date_str):
        parts = re.split(r"[-/]", date_str)
        td = date(int(parts[0]), int(parts[1]), int(parts[2]))
    else:
        raise ValueError(f"无法解析日期：{date_str}")

    stock_code = str(row["证券代码"]).strip().lstrip("'").zfill(6)
    stock_name = str(row["证券名称"]).strip()
    trade_time = _normalize_trade_time(str(row["成交时间"]).strip()) if "成交时间" in row.index else ""

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

    market_raw = str(row["交易市场"]).strip() if "交易市场" in row.index else ""
    market = _normalize_market(market_raw) if market_raw and market_raw.lower() != "nan" else _infer_market(stock_code)
    ts_code = f"{stock_code}.{market}"

    remark_col = "摘要" if "摘要" in row.index else None
    remark = str(row[remark_col]).strip() if remark_col and str(row[remark_col]).strip() not in ("nan", "") else None

    fee = calc_fee(side, market, amount, commission_rate, commission_min_fee_exempt)

    return Trade(
        account_id=account_id,
        trade_date=td,
        trade_time=trade_time,
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
        source=source,
        remark=remark,
        raw_row_id=raw_row_id,
        import_batch_id=batch_id,
    )


def _normalize_trade_time(raw: str) -> str:
    if raw.lower() in ("", "nan", "none"):
        return ""
    raw = raw.strip()
    if re.match(r"^\d{1,2}:\d{1,2}:\d{1,2}$", raw):
        h, m, s = (int(part) for part in raw.split(":"))
        return f"{h:02d}:{m:02d}:{s:02d}"
    if re.match(r"^\d{6}$", raw):
        return f"{raw[:2]}:{raw[2:4]}:{raw[4:6]}"
    raise ValueError(f"无法解析成交时间：{raw}")
