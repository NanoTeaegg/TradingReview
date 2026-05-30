# TradingReview

个人 A 股交易复盘工具。支持导入券商成交记录，自动计算 FIFO 盈亏、持仓、资金曲线，并结合 LLM 生成复盘报告。

## 快速开始

### 1. 启动后端

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### 2. 启动前端

```bash
cd frontend
pnpm install
pnpm dev
```

启动后默认进入**「模拟数据」账本**，其中已预置格力电器、招商银行、贵州茅台等虚构交易记录，可直接体验所有功能。

## 开始使用你自己的数据

### 第一步：新建账本

在顶栏点击当前账本名 →「设置」→「账本管理」→「新建账本」，填入账本名（如「主账户」）。

### 第二步：上传成交记录

切换到新账本，点击顶栏「上传文件」，选择从券商客户端导出的成交历史 `.xls` 文件即可。

> 同花顺、华泰、国君等主流券商均支持导出「成交历史」为 `.xls` 格式。

### （可选）删除模拟数据

熟悉功能后，可在「设置」→「账本管理」中删除「模拟数据」账本，输入账本名确认即可。

## 恢复模拟数据

如果需要重新导入演示数据（例如演示给他人看），有两种方式：

**方式一：脚本**

```bash
cd backend
source .venv/bin/activate
python scripts/seed_demo.py
```

**方式二：页面上传**

切换到「模拟数据」账本，点击「上传文件」，选择项目内的 `demo/20260421_20260528_demo.xls` 手动上传。

## 数据说明

- 本地数据库 `backend/tradingreview.db` 已在 `.gitignore` 中，不会提交到仓库，你的交易数据仅保存在本机。
- `demo/` 目录下的演示文件为虚构数据，不含真实交易信息，可放心分享。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vite + React 19 + TypeScript + Tailwind CSS + shadcn/ui |
| 后端 | FastAPI + SQLAlchemy 2.0 + SQLite (WAL) + Alembic |
| 行情 | TuShare + akshare |
