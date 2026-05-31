# TradingReview

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-%3E%3D3.11-blue.svg)](https://www.python.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9+-blue.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-blue.svg)](https://fastapi.tiangolo.com/)

> 把券商流水变成可复盘的交易日记  
> Turn broker exports into a reviewable trading journal

TradingReview 是一款面向个人 A 股投资者的本地复盘工具。支持导入同花顺等券商导出的成交历史，自动完成盈亏配对、持仓成本与资金曲线计算，并可记录每笔交易的标签、信心度与交易思路。内置交易总览、当日持仓、复盘统计与 AI 股票复盘，帮助把「原始流水 + 交易意图 + 数据洞察」串成完整复盘闭环。

TradingReview is a local review tool for individual A-share investors. Import trade history exported from brokers such as Tonghuashun to get automatic P&L matching, cost basis, holdings, and equity curve calculations. Annotate each trade with tags, confidence levels, and rationale. Dashboard, daily holdings, review analytics, and AI-powered stock reviews connect raw trades, trading intent, and data-driven insights into one review workflow.

## 快速开始

### 1. 后端

```bash
cd backend                                          # 进入后端项目目录
python -m venv .venv && source .venv/bin/activate  # 创建 Python 虚拟环境并激活（隔离项目依赖）
pip install -r requirements.txt                    # 根据清单安装后端所需的 Python 包
cp .env.example .env                               # 复制环境变量模板，稍后填入 TuShare Token
alembic upgrade head                               # 执行数据库迁移，创建 SQLite 数据库与表结构
python scripts/seed_demo.py                        # 写入演示账本（可选，首次体验功能时运行）
uvicorn app.main:app --reload                      # 启动后端 API 服务（默认 http://127.0.0.1:8000）
```

在 `backend/.env` 中配置：

```env
TUSHARE_API_KEY=你的_tushare_token
```

Token 在 [TuShare Pro](https://tushare.pro/) 注册后获取。免费积分约 120 分，足够日线行情与交易日历；部分高级接口有更高门槛。

### 2. 前端

```bash
cd frontend          # 进入前端项目目录
pnpm install         # 安装前端依赖包（需已安装 pnpm，见 https://pnpm.io/installation）
pnpm dev             # 启动前端开发服务器（默认 http://localhost:5173）
```

浏览器打开前端地址（默认 `http://localhost:5173`），顶栏左侧可切换账本。

### 3. 先用模拟数据体验

若运行了 `seed_demo.py`，默认进入**「模拟数据」账本**，预置格力电器、招商银行、贵州茅台等虚构成交，可直接体验导入、盈亏、复盘、AI 分析等全部功能。

### 4. 使用自己的数据

1. 顶栏点击账本名 → 进入**「设置」** → **「账本管理」** → **「新建账本」**（如「我的实盘」）
2. 点击新账本行切换为当前账本
3. 顶栏 **「上传文件」**，选择券商导出的成交历史 `.xls` / `.csv`

> 同花顺、华泰、国君等主流券商均支持导出「成交历史」为 `.xls` 格式。同一文件重复导入会自动去重。

如需准确的收益率曲线，可在设置页 **「资金记录」** 补录入金 / 出金。

### 5. 同步行情数据

持仓市值、浮动盈亏、净值对比大盘、盘面解析等依赖**本地日线库**，不会在你打开页面时实时调外部 API。数据需手动拉取，入口：**设置 → 行情数据**。

#### 两种同步方式

| 操作 | 适用场景 | 做了什么 |
|------|----------|----------|
| **初始化 / 修复全量历史** | 首次使用；或发现历史 K 线缺口 | 后台逐只股票拉取约 23 年日线（TuShare `daily(ts_code=…)`），同步交易日历、基准指数与盘面情绪；可断点续传、可取消 |
| **拉取最新行情** | 每个交易日收盘后（建议 16:00 后） | 从本地最新日期增量补到最近交易日（TuShare `daily(trade_date=…)` 一次拉全市场当日），并更新指数与情绪 |

**推荐流程：**

1. 按快速开始中在 `backend/.env` 配好 TUSHARE_API_KEY 并启动后端
2. 设置 → 行情数据 → 点 **「初始化全量历史」**，等待后台跑完（约 5000+ 只股票，需数小时，可关页面、后端保持运行）
3. 之后每个交易日点 **「拉取最新行情」** 即可

全量任务中断（如重启后端）后，再次点击同一按钮会从上次未完成处继续；进度与失败数可在该卡片查看。

#### 逻辑说明

```
TuShare / akshare  ──按钮触发──▶  SQLite 本地日线库 (market_daily_bars)
                                         │
                                         ▼
                              持仓 / 净值图 / 盘面解析（只读本地，不调外部 API）
```

- **按日增量**（拉取最新）：效率高，一次拿到全市场某一交易日的所有股票，适合日常更新。
- **按股全量**（初始化历史）：每只股票单独拉完整历史，全部完成后才算「拥有全量历史」；用于长周期回测与净值曲线。
- 导入成交流水**不会**自动拉行情，避免无谓消耗 TuShare 调用额度。

#### 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 设置页点拉取无反应 / 立即失败 | 未配置或填错 `TUSHARE_API_KEY` | 检查 `backend/.env`，改完后重启 `uvicorn` |
| 提示拉取失败 / 后端日志 `TuShare init failed` | Token 无效、网络或代理问题 | 确认 Token 有效；检查能否访问 `tushare.pro` |
| 当日持仓显示「行情获取失败」 | 本地无对应日期日线 | 设置 → 拉取最新行情；若仍失败，先跑全量历史 |
| 交易总览提示「汇总数据加载失败」 | 行情接口限频或超时 | 稍后重试；TuShare 有每分钟调用上限，全量同步期间避免频繁点拉取 |
| 全量进度显示「失败 N」 | 个别股票拉取异常（停牌、退市等） | 点 **「修复全量历史」** 重试；少量失败通常不影响持仓股 |
| 全量状态为「interrupted」 | 后端重启导致后台线程中断 | 再次点击 **「初始化 / 修复全量历史」** 续传 |
| 本地日线区间为空 | 从未成功拉取过 | 先确认 Token，再执行初始化全量历史 |

排查时可看运行 `uvicorn` 的终端日志，关键字：`tradingreview.market_sync`、`Sync stock daily … failed`。

### 6. 模拟数据的处理

| 需求 | 做法 |
|------|------|
| 日常只用真实数据 | 新建账本并切换即可；模拟账本的数据与真实账本**完全隔离** |
| 不想写入模拟数据 | 跳过 `python scripts/seed_demo.py`，直接新建账本并导入 |
| 删除模拟账本 | **默认「模拟数据」账本不可删除**（设置 → 账本管理，删除按钮置灰）。只要切换到自有账本，模拟数据不会影响你的复盘 |
| 演示数据被误删 / 想恢复 | 重新运行 `python scripts/seed_demo.py`（幂等：已有成交则跳过导入，仅补标签） |
| 彻底清空重来 | 停止后端，删除 `backend/tradingreview.db`，再 `alembic upgrade head`；按需决定是否重新 `seed_demo.py` |

`demo/` 目录下的演示 `.xls` 与 `seed_demo.py` 写入的成交均为**虚构数据**，不含真实交易信息，可放心分享或用于体验。

## 功能页面介绍

| 页面 | 路由 | 说明 |
|------|------|------|
| **交易总览** | `/` | 绩效摘要四卡片（总收益率 / 最大回撤 / 总盈亏 / 当前持仓盈亏）+ 收益率走势图（账户 vs 大盘对比，支持日期筛选）+ 成交流水列表（可过滤、可编辑意图）|
| **当日持仓** | `/holdings` | 盘面解析（上涨/下跌/平盘家数、涨跌停统计、成交额）+ 持仓明细（摊薄成本均价、最新价、持仓盈亏）+ 明日操作思路文本框 |
| **交易复盘** | `/intents` | **复盘统计**（胜率/盈亏比、标签维度拆分、交易纪律执行率、月换手率趋势）+ **历史交易列表**（按股票查看成交、标签、思路；点击进入股票复盘）|
| **股票复盘** | `/intents/stock/:code` | 该股全部成交流水 + 关联意图 + AI 复盘报告（流式生成，自动落库）|
| **交易规则** | `/rules` | Markdown 格式的个人交易系统规则编辑，支持版本历史与恢复；复盘时自动注入 LLM prompt |
| **设置** | `/settings` | 大模型配置（Ollama / OpenAI 兼容云端 API）、资金记录（出入金，用于计算真实收益率曲线）、标签管理、账本管理、行情数据同步 |

### 主要交互入口

- **上传文件**：顶栏右侧，支持同花顺等券商导出的 `.xls` / `.csv` 成交历史
- **编辑意图**：成交流水每行右侧，可打标签、填信心度、记录交易思路
- **AI 复盘**：「历史交易列表」点击任意股票 → 股票复盘页 → 「触发 AI 复盘」
- **账本切换**：顶栏左侧下拉，切换后全站数据随之刷新

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vite + React 19 + TypeScript + Tailwind CSS + shadcn/ui |
| 后端 | FastAPI + SQLAlchemy 2.0 + SQLite (WAL) + Alembic |
| 行情 | TuShare + akshare |
