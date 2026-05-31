# Changelog

本文件记录各版本的显著变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](docs/版本管理规范.md)。

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

[v0.1.1]: https://github.com/NanoTeaegg/TradingReview/releases/tag/v0.1.1
[v0.1.0]: https://github.com/NanoTeaegg/TradingReview/releases/tag/v0.1.0
