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

### 3. 导入演示数据（可选）

项目自带一份演示交易文件（`demo/20260421_20260528_demo.xls`），包含格力电器、招商银行、贵州茅台等虚构交易记录，方便体验功能。

**方式一：脚本导入（推荐新用户）**

```bash
cd backend
source .venv/bin/activate
python scripts/seed_demo.py
```

**方式二：页面上传**

在前端「上传文件」按钮处，选择 `demo/20260421_20260528_demo.xls` 手动上传到「模拟数据」账本。

> 如果你已经把「模拟数据」账本里的演示数据删除了，重新运行上述脚本或重新上传即可。

### 4. 导入你自己的成交记录

在同花顺、华泰、国君等券商客户端导出「成交历史」为 `.xls` 格式，在页面上传即可。

## 数据说明

- 本地数据库文件 `backend/tradingreview.db` 已在 `.gitignore` 中，不会提交到仓库，你的交易数据仅保存在本机。
- `demo/` 目录下的文件为虚构演示数据，不包含真实交易信息，可放心分享。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vite + React 19 + TypeScript + Tailwind CSS + shadcn/ui |
| 后端 | FastAPI + SQLAlchemy 2.0 + SQLite (WAL) + Alembic |
| 行情 | TuShare Pro + akshare |
| LLM | Deepseek / Ollama（可配置） |
