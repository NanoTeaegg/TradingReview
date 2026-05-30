## 需求变更规范
每次变更需求或新增需求，必须明确变更的范围并更新 /docs 文档内的规范文件，并记录变更记录。

---

## 技术栈（锁定，不得私自变更）

### 前端 `frontend/`
- **框架**：Vite + React 19 + TypeScript
- **样式**：Tailwind CSS v3 + CSS 变量 Design Token（见 `docs/UI_SPEC.md`）
- **组件库**：shadcn/ui（按需 add，不替换为其他库）
- **路由**：react-router-dom v7
- **数据请求**：@tanstack/react-query v5
- **表格**：@tanstack/react-table v8
- **HTTP**：axios
- **图表**：echarts + echarts-for-react
- **图标**：lucide-react

### 后端 `backend/`
- **框架**：Python + FastAPI + SQLAlchemy 2.0（Mapped[] 风格）
- **数据库**：SQLite（WAL 模式）+ Alembic 迁移
- **行情**：TuShare Pro 主 + akshare 兜底
- **大模型（预留）**：Deepseek API / Ollama

---

## 包管理工具规范（锁定）
- **前端**：一律使用 **pnpm**，禁止使用 npm 或 yarn 安装依赖
  - 安装依赖：`pnpm add <pkg>`
  - 安装开发依赖：`pnpm add -D <pkg>`
  - 运行脚本：`pnpm dev` / `pnpm build`
- **后端**：使用 **pip**（或 uv），依赖写入 `requirements.txt`

---

## 版本管理规范
- 主分支：`main`
- 功能开发在 `feat/xxx` 分支，完成后合并 main
- Commit 信息格式：`<type>: <subject>`（type: feat / fix / refactor / docs / style / chore）
- 数据库结构变更必须通过 **Alembic** 迁移，禁止直接修改已有迁移文件
- 前端 Design Token 来源唯一：`docs/UI_SPEC.md` → `src/styles/tokens.css`，不允许在组件内硬编码颜色/间距值

---

## 文件结构规范
- 规范文档统一放 `docs/`，包括：PRD.md / UX.md / UI_SPEC.md / 技术方案.md
- 前端源码根目录：`frontend/src/`
- 后端源码根目录：`backend/app/`