# 后端实现 TODO 清单（sonnet 逐条勾选执行）

> 配套文档：`frontend/docs/后端实现计划.md`（详细设计）· `PRD.md` · `技术方案.md`
> 执行原则：**自上而下顺序执行**；每完成一项勾选 `[x]`；遇到标 ❓ 的决策点若与默认不符再问用户。
> 全程铁律：金额一律 `Decimal`（SQLite 用 TEXT 存）· 证券代码字符串 · WAL · Alembic 建表 · SQLAlchemy 2.0 `Mapped[]` · 行情统一封装。

---

## 阶段 0 · 开工前置检查

- [ ] 确认 `.env` 有 `TUSHARE_API_KEY`（**变量名是 `TUSHARE_API_KEY` 不是 `TUSHARE_TOKEN`**），`config.py` 按此名读取并 `ts.set_token()`
- [ ] 确认 Python ≥ 3.11（`python3 --version`）
- [ ] 把样本 `20260421_20260528_Atrading.xls`（仓库根目录已存在）复制到 `backend/tests/fixtures/`
- [ ] 读 `frontend/src/lib/api.ts`（baseURL 默认 `http://localhost:8000`）与 `frontend/src/lib/mock.ts`，记录前端期望的字段形状，后端响应向其对齐
- [ ] 后端用 pip/uv，依赖写 `backend/requirements.txt`

---

## 阶段 1 · M1 地基（脚手架 + WAL + Alembic）

- [ ] 新建 `backend/` 目录树（见计划 §2）
- [ ] `backend/requirements.txt`：fastapi / uvicorn[standard] / sqlalchemy>=2.0 / alembic / pydantic / pydantic-settings / python-multipart / pandas / lxml / tushare / akshare / httpx / pytest
- [ ] 建虚拟环境并 `pip install -r requirements.txt`
- [ ] `app/core/config.py`：pydantic-settings 读 `.env`（`TUSHARE_API_KEY` / `DB_URL` 默认 `sqlite:///./tradingreview.db` / `OLLAMA_BASE_URL` / `OLLAMA_MODEL`）
- [ ] `app/core/db.py`：`create_engine(connect_args={"check_same_thread": False})` + `event.listens_for(Engine,"connect")` 执行 `PRAGMA journal_mode=WAL; foreign_keys=ON; synchronous=NORMAL`；`DeclarativeBase` / `SessionLocal` / `get_db` 依赖
- [ ] `app/models/types.py`：`Money(TypeDecorator, impl=String)` —— Decimal⇄字符串，按 scale 量化（计划 §3.1）
- [ ] `app/main.py`：FastAPI 实例 + CORS（放行前端 `http://localhost:5173`）+ `lifespan` + `/health` 路由 + 注册各 router
- [ ] `alembic init alembic`，配 `alembic/env.py` 指向 `Base.metadata` 与 `DB_URL`
- [ ] **验收**：`uvicorn app.main:app` 起服；`/health` 200；`PRAGMA journal_mode` 返回 `wal`

---

## 阶段 1b · 数据模型 + 首迁移（全部建表）

- [ ] `models/import_batch.py`：`import_batches` + `raw_import_rows`
- [ ] `models/trade.py`：`trades`（含 `UniqueConstraint(trade_date,stock_code,side,price,quantity,amount)` + `stock_code`/`trade_date` 索引；金额列用 `Money`）
- [ ] `models/intent.py`：`trade_intents`（tags JSON）+ `tags`（name unique）
- [ ] `models/review.py`：`review_reports`（scope/snapshot/rule_version_id）
- [ ] `models/rule.py`：`rule_versions`
- [ ] `models/setting.py`：`app_settings`（key PK）
- [ ] `models/market_cache.py`：`market_daily_bars`（stock/index 统一日线缓存，unique instrument_type+ts_code+date）+ `market_sentiment_snapshots`（盘面情绪快照，unique trade_date）
- [ ] `alembic revision --autogenerate` + `alembic upgrade head`
- [ ] **验收**：所有表建成；`alembic upgrade` 无报错（禁止用 `create_all` 当正式建表）

---

## 阶段 2 · M2 导入（功能 2 / PRD 2.1–2.8）

- [ ] `services/fee.py`：手续费规则（佣金 max(额×0.00008,5) 双向 / 印花税 额×0.0005 仅卖 / 过户费 额×0.00001 仅沪A双向 / transfer_in 不计费），全 Decimal `ROUND_HALF_UP` 到 2 位
- [ ] `services/importer.py`：
  - [ ] 读 bytes → `sha256` file_hash；命中 `import_batches.file_hash` → 拒绝「已导入」（2.3）
  - [ ] 格式探测：含 `<table>`/`<html>` → `pandas.read_html()`（2.7）；否则 GB18030 + `\r\n` 分行 + `\t` 分列 + 剔行尾空列
  - [ ] 表头校验（成交日期/证券代码/.../摘要）
  - [ ] 逐行解析：日期→date、代码 str 保前导零、买卖标志映射（买入/卖出/**担保品划入→transfer_in** 2.2）、price/amount Decimal（金额权威）、市场全角归一 深Ａ→SZ/沪Ａ→SH + 生成 ts_code、seq=行序、fee 由上一步算、source=ths_xls
  - [ ] 失败行收集 `{row_no,raw_text,error}` 不阻断（2.5）
  - [ ] 逐行去重：捕获 `IntegrityError`→skipped（2.4）
  - [ ] 写 `raw_import_rows`（parsed/error）+ `trades` + `import_batches`（period 从文件名解析，失败取 trades min/max 日期）
  - [ ] 返回 `{batch_id, inserted, skipped_dup, failed:[...]}`
- [ ] `api/routes/imports.py`：`POST /api/imports`（multipart）/ `GET /api/imports` / `GET /api/imports/{id}/rows`
- [ ] `tests/test_fee.py`：买/卖/沪A/深A/transfer_in 各分支
- [ ] `tests/test_importer.py`：样本行数、transfer_in 映射、去重、HTML 兜底、失败行收集
- [ ] **验收**：样本入库成功率 ≥99%；file_hash 二次上传被拦；重复行被跳过并标注

---

## 阶段 3 · M3 盈亏 + 行情 + 净值（功能 1 / 0.x / 6.1）

- [ ] `services/market.py` `MarketDataProvider`（TuShare 主 + akshare 兜底 + 重试）：
  - [ ] `get_latest_price(ts_codes)`→{price, pre_close}（盘中 akshare 实时 / 盘后 TuShare daily；皆失败上层提示不崩 1.6）
  - [ ] `get_daily` / `get_index_daily`（统一写 `market_daily_bars` 缓存，缺补）
  - [ ] `trade_cal`（交易日历）
- [ ] `services/sentiment.py`（akshare）：涨/跌/平家数与比例、涨停/跌停、成交额(亿)、数据日期/交易状态、情绪标签（>1.5 偏多/0.7–1.5 中性/<0.7 偏空）、非交易日休市
- [ ] `services/pnl.py`：
  - [ ] FIFO 引擎：按 (trade_date,seq) 配对；buy/transfer_in 入批次队列；sell 队首消耗产 round-trip；净已实现 = 卖出额 − 配对买入成本 − 分摊买入费 − 分摊卖出费（1.2 对账差=0）；transfer_in 不计买入资金、不产生已实现
  - [ ] 持仓总览：数量/均价/最新价/市值/浮动盈亏&率/当日盈亏（1.1/1.3/1.4）
  - [ ] 出入金记录：`cash_flows` 表与 `GET/POST/DELETE /api/cash-flows`；第一条资金记录默认生效于最早成交日，后续记录默认生效于录入当日（4.2）
  - [ ] 净值曲线：首笔成交日→今 逐交易日 以累计净入金、买卖现金流和持仓市值计算账户权益；净值=权益/累计净入金；叠加指数同期归一（0.1/0.2）
  - [ ] 绩效摘要：总收益率/最大回撤/累计已实现/当前浮动；收益率与回撤基于累计净入金，无入金记录时显示空态（0.3）
- [ ] `api/routes/trades.py`：`GET /api/trades?stock=&side=&start=&end=`
- [ ] `api/routes/positions.py`：`GET /api/positions` / `/equity-curve?benchmark=` / `/summary`
- [ ] `api/routes/market.py`：`GET /api/market/quotes?codes=` / `/sentiment`
- [ ] `tests/test_pnl_fifo.py`：小样本 round-trip 净盈亏与手工 **完全相等**（Decimal）
- [ ] **验收**：对账金额差=0；行情 fallback 生效；TuShare 限频做节流/批量

---

## 阶段 4 · M4 意图 + 标签 + 统计（功能 3）

- [ ] `api/routes/intents.py`：意图 CRUD（关联 trade_id 或仅 stock_code；tags/thesis/confidence 可选 3.1/3.2/3.3）+ `GET /api/intents/{id}/detail`（关联流水 + P&L 3.4/3.5）
- [ ] `api/routes/tags.py`：标签增删改（3.7）；删除前返回「已关联意图数」；**重命名**同步刷新 intents.tags JSON
- [ ] `services/stats.py` + `api/routes/stats.py`：
  - [ ] `win-rate`：基于 round-trip 胜率/均盈/均亏，可按标签拆分（3.8）
  - [ ] `discipline`：已打标签成交/总成交，<60% 提示（3.9）
  - [ ] `turnover`：每月成交额/月初市值，近6月趋势，>200% 标注（3.10）
  - [ ] `tag-performance`：按标签 次数/胜率/均盈亏/均持仓天数（3.11）
- [ ] **验收**：PRD 3.1–3.11

---

## 阶段 5 · M5 复盘 + 规则（功能 4 全量 + 4.5 规则）

- [ ] `services/rules.py` + `api/routes/rules.py`：`GET/PUT /api/rules`（保存=新建 rule_version + summary）/ `GET /api/rules/versions` / `POST /api/rules/versions/{id}/restore`（5.1–5.4）
- [ ] `api/routes/settings.py`：`GET/PUT /api/settings/ollama`（base_url 默认 localhost:11434 / model 默认 qwen2.5:14b）+ `POST /api/settings/ollama/ping`（调 `GET {base}/api/tags` 4.1）
- [ ] `services/review.py`：
  - [ ] 组装 input_snapshot：成交数据 + 行情 + 关联意图 + **当前规则全文** + 记 rule_version_id（可复现 5.4）
  - [ ] 三种 scope：trade / stock / period（4.3/4.4/4.5）
  - [ ] 调 Ollama `POST {base}/api/chat`（stream，`httpx.AsyncClient.stream`）→ FastAPI `StreamingResponse`（❓ 优先 SSE，前端不便则整段返回）
  - [ ] 流结束落库 `review_reports`（content/model/snapshot/rule_version_id 4.6）
- [ ] `api/routes/reviews.py`：`POST /api/reviews`（流式）/ `GET /api/reviews` / `GET /api/reviews/{id}`（4.6/4.7 倒序）
- [ ] **验收**：PRD 4.1/4.3–4.7、5.1–5.4

---

## 阶段 6 · 收尾

- [ ] `backend/.env.example`（含 `TUSHARE_API_KEY=` 占位 + Ollama 默认值）
- [ ] `backend/.gitignore`：`*.db` / `*.db-wal` / `*.db-shm` / `__pycache__/` / `.venv/`
- [ ] `backend/README.md`：起服命令、迁移命令、测试命令
- [ ] `pytest` 全绿
- [ ] 按 CLAUDE.md：在 `feat/backend` 分支开发，commit 用 `<type>: <subject>`；若改了需求范围更新 `docs/` 文档变更记录

---

## ❓ 沿途默认决策（与默认不符再问用户）

1. DB 文件：`backend/tradingreview.db`
2. 最新价：盘中 akshare 实时 / 盘后当日收盘，能取即用、失败兜底
3. enum 存字符串值（buy/sell/transfer_in、SZ/SH、trade/stock/period）
4. 复盘流式：优先 SSE
5. 指数代码：沪深300=`000300.SH`、上证=`000001.SH`
