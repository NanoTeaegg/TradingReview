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
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head          # 创建数据库与表结构
python scripts/seed_demo.py   # 写入演示账本数据（首次必须）
uvicorn app.main:app --reload
```

### 2. 前端

```bash
cd frontend
pnpm install
pnpm dev
```

启动后默认进入**「模拟数据」账本**，其中预置了格力电器、招商银行、贵州茅台等虚构交易记录，可直接体验所有功能。

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

## 使用自己的数据

1. 顶栏点击账本名 →「设置」→「账本管理」→「新建账本」
2. 切换到新账本，点击顶栏「上传文件」，选择券商导出的成交历史 `.xls`

> 同花顺、华泰、国君等主流券商均支持导出「成交历史」为 `.xls` 格式。

熟悉功能后，可在「账本管理」中删除「模拟数据」账本。

## 恢复模拟数据

演示账本被删除或数据库重建后，重新运行：

```bash
cd backend
source .venv/bin/activate
python scripts/seed_demo.py
```

脚本幂等：若该账本已有交易记录则自动跳过，不会重复导入。

## 数据说明

`demo/` 目录下的演示文件为虚构数据，不含真实交易信息，可放心分享。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vite + React 19 + TypeScript + Tailwind CSS + shadcn/ui |
| 后端 | FastAPI + SQLAlchemy 2.0 + SQLite (WAL) + Alembic |
| 行情 | TuShare + akshare |
