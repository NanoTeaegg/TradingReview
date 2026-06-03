# Changelog

本文件记录各版本的显著变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](docs/版本管理规范.md)。

## [v0.2.2] - 2026-06-03

性能与体验小迭代：前端路由懒加载 + 图表按需加载彻底解决首屏大包，「拉取最新行情」秒级返回不再被限频退避拖死并刷屏，数据库换索引让最新日期查询从秒级降到毫秒级，并调整基准指数集合与同步文案。

> ⚠️ 升级需执行数据库迁移：`alembic upgrade head`（新增 `market_daily_bars` 的 `(instrument_type, trade_date)` 索引，约几十秒，期间请勿点击「拉取最新行情」）。

### Added

- 交易总览「收益率走势」基准指数新增科创50（`000688.SH`）

### Changed

- 默认基准指数集合调整为 上证综指 / 沪深300 / 创业板指 / 科创50（替换原深证成指），前后端配色同步
- 「拉取最新行情」结果文案优化：换行展示待补基准指数与限额提示（「低积分下 index_daily 限额 1次/小时，请升级积分计划或约 1 小时后再次拉取」）
- 设置页「行情数据」优先展示本地 `localStorage` 状态缓存，后台检索期间禁用同步按钮并显示「数据检索中」
- 行情同步指数补齐改为一轮最多补 1 个缺口指数（规避 index_daily 1次/小时 + 5次/天 限额），剩余基准下轮续补
- 本地日线区间与行情同步说明文案精简

### Performance

- 前端页面改为路由级 `React.lazy` + `Suspense`，ECharts 按需注册组件，Vite/Rolldown 将 `echarts`/`zrender` 拆为独立异步 vendor chunk，消除单 chunk 超 500KB 警告与首屏大包
- React Query 缓存策略优化：全局 `gcTime` 24h、本地视图 5min `staleTime`、行情类查询挂载后每小时刷新、`AppLayout` 空闲预取核心数据
- 「拉取最新行情」秒级返回：`index_daily` 与情绪快照撞限频立即放弃、不再做 62s 退避（背景定时采集与下次同步补齐），避免任务长时间 running 触发前端状态轮询刷屏
- `market_daily_bars` 换索引：删除与唯一约束重复的 `ix_market_daily_bars_lookup`，新增 `(instrument_type, trade_date)`，`MAX(trade_date)` 由全分区扫描（1500 万+行）约 6.7s 降至约 2ms

### Fixed

- 修复 ECharts 在 vite 8 / rolldown 下因 `echarts-for-react` CJS 默认导出 interop 未解包导致的「Element type is invalid … got: object」页面加载失败（改用 ESM 入口 + 防御性解包）

### Docs

- PRD / UX / UI_SPEC / 技术方案 / 后端实现计划与 TODO 同步更新基准指数、缓存策略、懒加载与限频处理的变更记录

---

## [v0.2.1] - 2026-06-01

补丁版：处理 v0.2.0 复审反馈，修复金额展示小数位、明确文档公式并补充手续费校验测试。

### Fixed

- 资金记录金额展示（`formatExactAmount`）始终保留两位小数，修复尾零裁剪后可能出现 `¥1.234` 这类三位小数

### Docs

- PRD 3.10 / 技术方案 9.5.1 / 后端实现计划：周换手率公式补全括号，明确为 `(本周买入金额 + 卖出金额) / 本周平均持仓市值`

### Tests

- 新增 `normalize_commission_rate` 负值/超上限（0.003）校验用例，以及 `PUT /api/settings/fee` 佣金率超限返回 400 的接口用例

---

## [v0.2.0] - 2026-06-01

复盘统计、行情同步与交易导入增强版：交易复盘新增周维度趋势与指标说明，「拉取最新行情」重构为后台任务彻底解决卡死/超时，新增按账本手续费设置与多券商导入适配。

### Added

- 交易复盘：新增「周收益率」折线与「周换手率趋势」折线（替代原月换手率柱状），换手率按 80%/150% 阈值绿/黄/红分段、虚线标注，Tooltip 展示成交额/周平均持仓/买卖拆分
- 交易复盘：新增「指标说明」弹窗，解释各项统计口径与动态调整建议
- 设置：新增「手续费设置」模块，总佣金费率按账本保存（默认 0.04%、上限 0.3%、可选「免5」；口径含规费、对齐券商交割单「佣金」一栏），保存后自动重算当前账本历史成交手续费；证管费/经手费/过户费标注「已含在总佣金内」、印花税单独计收，按 A 股固定费率只读展示
- 导入：成交流水新增 `trade_time`（秒级成交时间），纳入去重唯一键；新增北交所（BJ）市场识别
- 行情同步：新增 `GET /api/market/sync/status` 后台任务进度查询

### Changed

- 「拉取最新行情」由同步阻塞接口重构为后台任务：`POST /api/market/sync` 立即返回，前端轮询进度并在完成后刷新视图；TuShare 限频退避不再顶穿前端超时或拖死服务
- 交易导入改为三层 adapter 机制：固定适配已支持券商模板（`ths_standard`/`ths_contract_export`）+ 严格校验必需成交字段 + 未知模板返回表头与缺失字段（不自动入库），避免把委托价/参考价等误判为成交价
- 手续费计算口径：总佣金可配置（含券商净佣金 + 证管费/经手费/过户费，对齐券商交割单「佣金」），印花税卖出单独计收；「免5」未勾选时总佣金最低 5 元
- 交易总览「收益率走势」横轴仅显示区间首尾日期，中间日期经 Tooltip 查看，右侧留白避免末尾日期截断
- `/api/stats/turnover` 输出近 12 个自然周的周换手率、周平均持仓、买卖笔数/金额与阈值等级

### Fixed

- 优化换手率计算口径（周买卖成交额 / 周平均持仓市值，本地日线价优先、成本兜底）
- 行情同步「未收盘」提示文案订正：A 股 15:00 已收盘，改为「今日日线数据尚未就绪」，明确数据约 16:10 可下载
- 情绪快照的 TuShare/akshare 调用加硬超时降级，指数日线命中小时/天级限频时跳过其余基准，避免后台同步长时间挂起

### Migrations

- `7d1e4f8a2c9b` 账户手续费设置字段；`8f2c6a9d4b1e` 成交流水 `trade_time` 字段

---

## [v0.1.1] - 2026-05-31

修复版：恢复 AI 股票复盘大模型调用，并优化设置页模型配置体验。

### Fixed

- AI 股票复盘：`review.py` 缺少 `import json`，触发模型分析时抛出 `NameError` 导致复盘失败

### Changed

- 设置页大模型：模型选择改为常驻输入框 + 可滚动列表，「获取模型」与输入框同行
- 连接测试失败时展示结构化错误说明与排查指引
- 账户/标签区块输入框与按钮圆角统一为 `rounded-md`

---

## [v0.1.0] - 2026-05-31

首个对外标记版本：本地 A 股复盘工具核心功能可用，适合个人安装体验。

### Added

- 交易总览：绩效摘要、收益率曲线（账户 vs 大盘）、成交流水与意图编辑
- 当日持仓：盘面解析、持仓明细、明日操作思路
- 交易复盘：胜率/盈亏比、标签维度统计、历史交易列表与股票复盘页
- AI 股票复盘：流式生成报告，支持 Ollama / OpenAI 兼容 API
- 设置：账本管理、资金记录、标签管理、大模型配置、行情数据同步
- 券商成交历史导入（同花顺等 `.xls` / `.csv`），FIFO 盈亏配对
- 行情：TuShare 日线同步（全量历史 + 按日增量）、本地 SQLite 缓存
- 演示数据：`seed_demo.py` 一键体验
- CI：Backend Tests + Frontend Build；`main` 分支保护 + PR 合并流程

### Changed

- UI 统一 A 股涨跌色规范（Design Token）
- 交易意图标签由 JSON 字段改为 `intent_tag_link` 关联表

### Fixed

- AI 复盘接入真实 API，改为 upsert 覆写
- CI 市场同步测试在无 TuShare Token 环境下通过（mock `pro_api`）

---

[v0.2.1]: https://github.com/NanoTeaegg/TradingReview/releases/tag/v0.2.1
[v0.2.0]: https://github.com/NanoTeaegg/TradingReview/releases/tag/v0.2.0
[v0.1.1]: https://github.com/NanoTeaegg/TradingReview/releases/tag/v0.1.1
[v0.1.0]: https://github.com/NanoTeaegg/TradingReview/releases/tag/v0.1.0
