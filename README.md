# TradingReview

个人 A 股交易复盘工具。支持导入券商成交记录，自动计算 FIFO 盈亏、持仓、资金曲线，并结合 LLM 生成复盘报告。

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
