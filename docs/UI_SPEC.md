# UI 设计规范：TradingReview 持仓股管理与交易复盘工具

> 状态：迭代中 · 最后更新：2026-05-30 · 负责人：AllenMakerZ  
> 输入：[PRD.md](./PRD.md) · [UX.md](./UX.md)  
> 下游：前端实现（frontend-dev）

---

## 1. 文档信息

### 1.1 基本信息

- **文档**：TradingReview Web UI 规范
- **目标平台**：Web 桌面端（Chrome/Safari，≥1280px 主视口）
- **项目**：个人 A 股持仓管理与交易复盘工具
- **状态**：初版
- **日期**：2026-05-29
- **参考来源**：Claude (Anthropic) 设计系统（暖色调、羊皮纸质感、砖红主色）+ Web 效率工具规范

### 1.2 平台范围

- **本文档覆盖**：桌面浏览器 Web 应用，视口宽度 ≥ 1280px
- **明确不覆盖**：移动端（iOS/Android 原生 App）、平板端适配、PWA 专项规范

---

## 2. 设计目标与原则

### 2.1 产品气质

TradingReview 是一个供个人投资者使用的**私人复盘工作台**——它不是面向大众的金融 App，而是一本带数据的私人交易日记。视觉语言应传递：

- **沉静而不冷酷**：像一本纸质笔记本，而不是路透社终端
- **数据精准，有温度**：数字清晰可读，但整体氛围温暖，不焦虑
- **专注于分析，而非操作**：没有大量红绿闪烁的行情 App 那种紧张感

### 2.2 使用场景

- 每日开盘前/收盘后，在桌面浏览器中打开查看持仓与盈亏（扫视型）
- 操作完一笔交易后，立即补录意图标签（快速录入型，≤30 秒）
- 周末/阶段性复盘，阅读 AI 报告、查看统计（深度阅读型）

### 2.3 UI 设计原则

1. **暖色调统一**：所有中性灰必须带黄棕底调，不出现冷蓝灰
2. **数字优先**：盈亏、价格、比例等数字使用等宽数字字体，右对齐，量级一眼可辨
3. **克制的主色**：砖红（Terracotta）仅用于主操作按钮、选中状态、品牌点缀，不泛滥
4. **层级靠背景色，不靠阴影**：用羊皮纸（Parchment）→ 象牙（Ivory）→ 纯白（White）三层背景建立深度，少用投影
5. **状态一定有视觉反馈**：加载骨架屏、空态文案、错误 Banner 是一等公民，不允许空白或崩溃

---

## 3. 视觉方向

### 3.1 风格关键词

`温暖克制` · `文人工作台` · `复盘日记` · `砖红×羊皮纸` · `数据沉静感`

参考来源：Claude (Anthropic) 设计系统  
气质种子匹配：AI 产品 + 金融科技混合，以 Claude 暖色调为主，以金融工具的数字精准为约束

### 3.2 视觉取舍

| 取 | 舍 |
|---|---|
| 羊皮纸暖底色（#f5f4ed）作为顶部导航栏背景 | 纯白或冷灰背景 |
| 砖红（#c96442）作为唯一主色 | 多彩主题色 |
| 衬线字体用于页面大标题和报告阅读区 | 纯无衬线方案 |
| 环形阴影（ring shadow）表达交互深度 | 传统 box-shadow 投影 |
| 盈亏遵循 A 股惯例：红涨（#b53333）绿跌（#16a34a）| 高饱和荧光红绿 |
| 骨架屏 + 空态文案 | loading spinner 打转 |

### 3.3 禁用风格

- 不用冷蓝灰（#6b7280 之类纯灰）作为中性色，所有灰必须偏黄棕
- 不用纯黑 `#000000` 或纯白 `#ffffff` 作为页面底色
- 不在非代码区域使用等宽字体
- 不在非 CTA/关键状态处使用砖红色
- 不用大面积渐变
- 不在按钮/卡片上用高阴影（禁用超过 `0 8px 24px` 级别的 drop shadow）

---

## 4. Design Tokens

### 4.1 颜色 Tokens

#### 背景层级（浅色模式，三层叠加建立深度）

| Token | 值 | 用途 | 注意事项 |
|---|---|---|---|
| `color-bg-sidebar` | `#f5f4ed`（Parchment 羊皮纸） | 左侧导航栏背景 | 整个产品的情绪锚点 |
| `color-bg-app` | `#faf9f5`（Ivory 象牙） | 主内容区页面背景 | 比侧边栏亮一档，拉开层次 |
| `color-bg-surface` | `#ffffff`（Pure White） | 卡片、表格、弹窗背景 | 数据展示区最亮层 |
| `color-bg-surface-hover` | `#f5f4ed`（Parchment） | 表格行 hover、可点击列表 hover | 背景色变化即 hover 状态，不加边框 |
| `color-bg-surface-selected` | `#e8e6dc`（Warm Sand） | 选中行、激活导航项 | 与 hover 拉开一档 |
| `color-bg-tag` | `#e8e6dc`（Warm Sand） | 标签/Badge 背景 | 统一所有 tag 底色 |

#### 文字颜色

| Token | 值 | 用途 | 注意事项 |
|---|---|---|---|
| `color-text-primary` | `#141413`（Anthropic Near Black） | 标题、主要数字、关键信息 | 对比度最高 |
| `color-text-secondary` | `#5e5d59`（Olive Gray） | 辅助说明、次级字段、占位文字 | 不承载关键操作 |
| `color-text-tertiary` | `#87867f`（Stone Gray） | 元数据、时间戳、禁用提示 | 仅用于低优先级信息 |
| `color-text-disabled` | `#b0aea5`（Warm Silver） | 禁用态文字 | 配合 `cursor: not-allowed` |
| `color-text-on-dark` | `#faf9f5`（Ivory） | 深色背景上的文字（如深色按钮） | — |
| `color-text-on-brand` | `#faf9f5`（Ivory） | 砖红背景上的文字 | — |

#### 主色与交互色

| Token | 值 | 用途 | 注意事项 |
|---|---|---|---|
| `color-primary` | `#c96442`（Terracotta 砖红） | 主 CTA 按钮、选中态高亮、链接强调 | 全局主色，克制使用 |
| `color-primary-hover` | `#b85538` | 主按钮 hover 态 | 比主色深一档 |
| `color-primary-active` | `#a84828` | 主按钮按下态 | 再深一档 |
| `color-primary-subtle` | `rgba(201,100,66,0.08)` | 主色轻底色，用于选中行背景 | 低调强调 |
| `color-focus-ring` | `#3898ec`（Focus Blue） | 键盘焦点环 | 系统内唯一冷色，仅用于无障碍焦点 |

#### 语义色（金融场景适配）

| Token | 值 | 用途 | 注意事项 |
|---|---|---|---|
| `color-profit` | `#b53333`（暖红，A 股涨色） | 盈利、上涨、正数盈亏 | 遵循 A 股红涨惯例；配合 `↑` 图标或 `+` 前缀表达语义，不单靠颜色 |
| `color-profit-bg` | `rgba(181,51,51,0.08)` | 盈利行轻底色（可选） | 谨慎使用，避免视觉噪音 |
| `color-loss` | `#16a34a`（暖绿，A 股跌色） | 亏损、下跌、负数盈亏 | 遵循 A 股绿跌惯例 |
| `color-loss-bg` | `rgba(22,163,74,0.08)` | 亏损行轻底色（可选） | 谨慎使用 |
| `color-neutral-market` | `#5e5d59`（Olive Gray） | 平盘、中性情绪标签 | — |
| `color-success` | `#16a34a` | 操作成功反馈（Toast、Banner）| UI 交互语义色，与 color-loss 值相同但用途不同 |
| `color-warning` | `#d97706`（暖琥珀） | 纪律执行偏低警示、数据缺失提示 | — |
| `color-danger` | `#b53333` | 删除确认、错误 Banner | UI 交互语义色，与 color-profit 值相同但用途不同 |
| `color-info` | `#5e5d59`（Olive Gray） | 中性信息提示 | 使用暖灰而非蓝色 |

#### 边框与分隔线

| Token | 值 | 用途 | 注意事项 |
|---|---|---|---|
| `color-border-subtle` | `#f0eee6`（Border Cream） | 表格分隔线、卡片边框（低调） | 刚好可见即可 |
| `color-border-default` | `#e8e6dc`（Border Warm） | 输入框、较突出的容器边框 | 标准边框 |
| `color-border-strong` | `#d1cfc5`（Ring Warm） | 分区强分隔线、激活输入框 | — |

#### 图表色系

| Token | 值 | 用途 |
|---|---|---|
| `color-chart-portfolio` | `#c96442`（Terracotta） | 账户收益率曲线（主线，带面积渐变） |
| `color-chart-index` | `#5e5d59`（Olive Gray） | 沪深300 对比线 |
| `color-chart-grid` | `#f0eee6`（Border Cream） | 图表辅助网格线 |
| 基准·上证综指 | `#a07e5a` | 上证综指对比线（中性暖灰） |
| 基准·深证成指 | `#7d8a6a` | 深证成指对比线（中性橄榄） |
| 基准·创业板指 | `#9a7aa0` | 创业板指对比线（中性紫灰） |
| 收益率走势 0% 基线 | `#d1cfc5`（Border Strong） | 纵轴 0% 实线参考线（0% 居中） |
| `color-chart-series-1` | `#c96442` | 图表系列 1 |
| `color-chart-series-2` | `#5e5d59` | 图表系列 2 |
| `color-chart-series-3` | `#87867f` | 图表系列 3 |
| `color-chart-series-4` | `#b0aea5` | 图表系列 4 |

---

### 4.2 文字 Tokens

#### 字体族

| Token | 值 | 用途 |
|---|---|---|
| `font-family-serif` | `'Anthropic Serif', 'Noto Serif SC', Georgia, serif` | 页面大标题、品牌字标、AI 报告阅读区；中文缺字时降级到 `Noto Serif SC` |
| `font-family-sans` | `'Anthropic Sans', 'Noto Sans SC', -apple-system, sans-serif` | 所有 UI 文字、表格、表单、导航 |
| `font-family-mono` | `'Anthropic Mono', 'JetBrains Mono', monospace` | 代码块、股票代码（等宽强调）、终端输出 |
| `font-feature-tabular` | `font-variant-numeric: tabular-nums` | **所有价格、盈亏金额、比例数字必须开启**，保证列对齐 |

> **字体来源**：Anthropic Sans（300–700）/ Anthropic Serif（300–700）/ Anthropic Mono（400）均来自 `anthropic-fonts@1.1.0`（MIT License），字体文件存放于 `frontend/public/fonts/`，通过 `@font-face` 在 `tokens.css` 中声明。

#### 基础字号

全局 html `font-size: 16px`（Tailwind rem 基准）。

#### 字号层级

| Token | 值 | 字族 | 字重 | 行高 | 用途 |
|---|---|---|---|---|---|
| `font-size-page-title` | `32px` | Serif | 500 | 1.25 | 页面标题（如「持仓总览」「交易意图」），必须左对齐 |
| `font-size-section-title` | `22px` | Sans | 650 | 1.35 | 页面内一级区块标题、强内容分组标题 |
| `font-size-panel-title` | `18px` | Sans | 600 | 1.40 | 卡片组标题、图表标题、表格上方标题 |
| `font-size-card-title` | `16px` | Sans | 600 | 1.40 | 卡片标题、模块小标题 |
| `font-size-body` | `14px` | Sans | 400 | 1.60 | 正文、表格内容、表单文字 |
| `font-size-body-sm` | `13px` | Sans | 400 | 1.50 | 辅助说明、Tooltip、元数据 |
| `font-size-caption` | `12px` | Sans | 400 | 1.50 | 时间戳、版权、最小级文字（letter-spacing: 0.1px）|
| `font-size-label` | `12px` | Sans | 500 | 1.40 | 表单标签、Badge 文字 |
| `font-size-number-lg` | `28px` | Sans | 600 | 1.20 | 绩效摘要大数字（总收益率等）|
| `font-size-number-md` | `20px` | Sans | 600 | 1.30 | 持仓市值、总盈亏金额 |
| `font-size-report-body` | `16px` | Serif | 400 | 1.75 | AI 复盘报告正文（文学阅读节奏）|
| `font-size-module-switch` | `14px` | Sans | 400/600 | 1.40 | 顶部主导航与页内 Tab，采用同一套细横条切换样式 |
| `font-size-brand-wordmark` | `34px` | Serif | 700 | 1.00 | 顶部品牌字标「Trading Review」 |

#### 排版层级与切换模式

**参考模式：** 可借鉴 Claude Code Docs 的文档型排版关系：同一内容栏左边线起排，通过字号、字重、下划线、上下留白切换层级；不通过居中、缩进漂移或随意改变容器宽度制造层级。颜色继续使用 TradingReview 自有主题色（Terracotta 砖红 + 暖中性色），不得照搬参考站点配色。

| 层级 | 用途 | 字体规则 | 切换/激活模式 | 对齐规则 |
|---|---|---|---|---|
| L0 Brand | 顶部品牌字标 | Serif 34px / 700 | 不参与页面状态切换 | 与内容栏左边线同轴，Logo 左缘可向左占用图标宽度，字标基线不可漂移 |
| L1 Primary Nav | 顶部主导航（总览/盈亏/流水等） | Sans 14px / active 600 / default 400 | 当前页：近黑文字 + 2px `color-primary` 下划线；Default：secondary 文字；Hover：文字加深 | 使用与页内 Tab 相同的细横条切换样式 |
| L2 Page Title | 页面标题 | Serif 32px / 500 | 路由切换时替换文案，不做居中或动画位移 | 必须左对齐内容栏起排线 |
| L3 Page Tabs | 页面内 Tab（如「意图列表 / 复盘统计」） | Sans 14px / active 600 / default 400 | Active：近黑文字 + 2px `color-primary` 下划线；Default：secondary 文字 | 与顶部主导航同源，保留更细、更克制的质感 |
| L4 Section Title | 页面内一级区块 | Sans 22px / 650 | 展开/折叠时标题不位移，仅图标旋转或内容显隐 | 与所属内容容器左内边距对齐 |
| L5 Panel/Card Title | 卡片、图表、表格标题 | Sans 18px / 600 或 16px / 600 | 卡片状态变化不改变标题位置 | 与卡片内容左内边距对齐 |
| L6 Body/Meta | 正文、说明、元数据 | Sans 14px / 400；Meta 12-13px | 状态变化只改颜色/图标，不改字号 | 文本列左对齐；数字列右对齐 |

**硬性排版规则：**
- 禁止页面标题、Tab 组、区块标题使用 `text-align: center`；除空态文案和弹窗正文外，业务页面内容默认左对齐。
- 顶部品牌区、主导航、主内容容器必须共用同一套 `content-max-width + content-padding-x`，形成一条稳定左起排线。
- 页面内不同层级的切换优先使用「字号 + 字重 + 2px 主题色下划线 + 上下间距」，不使用随机缩进、宽度变化或大面积背景块。
- 表格保持金融数据规则：文本列左对齐，数字列右对齐，状态列居中；该规则优先级高于全局左对齐。

**数字格式规则：**
- 所有价格和金额：`font-variant-numeric: tabular-nums`，右对齐
- 正数盈亏：`color-profit` + `+` 前缀
- 负数盈亏：`color-loss` + `-` 前缀（不用括号）
- 百分比：保留两位小数
- 金额：万元以上显示「万」，亿元以上显示「亿」（如 `¥1.23亿`）
- 资金记录中的累计净入金与单条入金/出金金额例外：显示完整金额（如 `¥885,100.00`），不使用「万/亿」缩写

---

### 4.3 间距与布局 Tokens

| Token | 值 | 用途 |
|---|---|---|
| `space-1` | `4px` | 图标与文字间距、Badge 内边距 |
| `space-2` | `8px` | 控件内部紧凑间距、行内元素间距 |
| `space-3` | `12px` | 表单字段间距、列表项内边距 |
| `space-4` | `16px` | 卡片内边距、区块内标准间距 |
| `space-5` | `20px` | 卡片间距 |
| `space-6` | `24px` | 页面内区块间距 |
| `space-8` | `32px` | 页面主要板块间距 |
| `space-10` | `40px` | 页面顶部 padding、大区块间距 |
| `topbar-height` | `116px` | 顶部双行导航栏固定高度 |
| `topbar-primary-max-width` | `1400px` | 顶部第一行最大内容宽度；必须与 `content-max-width` 一致，保证品牌、导航、页面标题左对齐 |
| `topbar-secondary-max-width` | `1400px` | 顶部第二行最大内容宽度；必须与 `content-max-width` 一致 |
| `content-padding-x` | `40px` | 主内容区左右内边距 |
| `content-padding-y` | `36px` | 主内容区上下内边距 |
| `content-max-width` | `1400px` | 主内容最大宽度（超宽屏不无限扩展）|
| `table-row-height-compact` | `36px` | 紧凑表格行高（流水列表）|
| `table-row-height-standard` | `44px` | 标准表格行高（持仓列表）|
| `right-panel-width` | `400px` | 右侧滑出面板宽度（意图录入）|

---

### 4.4 圆角、边框与阴影 Tokens

| Token | 值 | 用途 |
|---|---|---|
| `radius-xs` | `4px` | Badge、小 Tag |
| `radius-sm` | `6px` | 表格内小按钮、图标按钮 |
| `radius-md` | `8px` | 标准按钮、输入框、标准卡片 |
| `radius-lg` | `12px` | 主要卡片容器、弹窗 |
| `radius-xl` | `16px` | 右侧滑出面板、复盘报告容器 |
| `radius-2xl` | `24px` | 大卡片强调容器（首次使用引导区）|
| `border-width` | `1px` | 所有边框统一宽度 |
| `shadow-ring` | `0px 0px 0px 1px #d1cfc5` | 按钮 hover/focus 环形阴影（Claude 签名式）|
| `shadow-ring-brand` | `0px 0px 0px 1px #c96442` | 砖红按钮环形阴影 |
| `shadow-card` | `0 2px 8px rgba(20,20,19,0.06)` | 卡片轻浮起（仅用于重要卡片）|
| `shadow-panel` | `-4px 0 24px rgba(20,20,19,0.08)` | 右侧滑出面板左侧阴影 |
| `shadow-modal` | `0 8px 32px rgba(20,20,19,0.12)` | 弹窗阴影 |

---

### 4.5 层级与动效 Tokens

| Token | 值 | 用途 |
|---|---|---|
| `z-sticky` | `100` | 固定表头、工具栏 |
| `z-dropdown` | `200` | 下拉菜单、日期选择器 |
| `z-panel` | `300` | 右侧滑出面板 |
| `z-modal` | `400` | 确认弹窗 |
| `z-toast` | `500` | Toast 通知 |
| `motion-fast` | `120ms ease` | hover 背景色变化、focus ring 出现 |
| `motion-medium` | `200ms ease` | 右侧面板滑入、弹窗出现、下拉展开 |
| `motion-slow` | `300ms ease` | 页面级过渡（少用）|
| `motion-streaming` | CSS cursor blink `1s infinite` | AI 报告流式输出光标动画 |

**动效档位：L1**（仅 hover 反馈 + 轻入场，无滚动触发动效，无粒子/WebGL）

---

### 4.6 图标与数据可视化 Tokens

| Token | 值 | 用途 |
|---|---|---|
| `icon-size-sm` | `16px` | 行内图标、表格操作图标 |
| `icon-size-md` | `20px` | 导航图标、按钮图标 |
| `icon-size-lg` | `24px` | 空态插图辅助图标 |
| `icon-stroke` | `1.5px` | 线性图标统一描边宽度 |
| `icon-style` | Lucide 风格（线性，无填充） | 全局图标风格统一 |
| `chart-axis-color` | `#87867f`（Stone Gray） | 图表坐标轴文字 |
| `chart-grid-color` | `#f0eee6`（Border Cream） | 图表辅助网格线 |
| `chart-tooltip-bg` | `#141413`（Near Black） | 图表 Tooltip 深色背景 |
| `chart-tooltip-text` | `#faf9f5`（Ivory） | 图表 Tooltip 文字 |

---

## 5. 平台布局规则

### 5.1 页面框架

```
┌──────────────────────────────────────────────────────────────────────────┐
│  顶部导航栏（固定，116px 高，bg: #faf9f5）                               │
│  第一行：Trading Review                      [账本切换 ▾] | 设置 | 上传文件 | 导入历史 │
│  ─────────────────────────────────────────────────────────────────────── │
│  第二行：总览   盈亏   流水   交易意图   复盘报告   交易规则               │
├──────────────────────────────────────────────────────────────────────────┤
│  主内容区（bg: #faf9f5，最大宽度 1400px，padding: 36px 40px）            │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  页面标题（Serif 32px，左对齐内容栏起排线）                         │  │
│  │                                                                    │  │
│  │  内容卡片（bg: #ffffff）                                           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**统一左对齐基线（强制）：**
- 顶部第一行、顶部第二行、主内容区必须使用同一组容器参数：`max-width: content-max-width`，左右 padding 为 `content-padding-x`。
- 品牌字标、主导航第一项、页面 H1、页面内 Tab 第一项必须共享同一条视觉左边线；允许 Logo 图形位于字标左侧，但不得改变字标与正文的对齐关系。
- 不允许第一行、第二行、主内容区分别使用不同 max-width 造成横向漂移。

**三层背景建立层级（无需阴影）：**
1. 顶部导航栏：`#faf9f5` Ivory（与页面背景一致）
2. 主内容区：`#faf9f5` Ivory（与顶部导航连续）
3. 卡片/表格：`#ffffff` White（最亮）

### 5.2 栅格与断点

| 断点 | 视口宽度 | 处理方式 |
|---|---|---|
| 标准桌面 | ≥ 1280px | 全量布局，顶部双行导航栏完整显示所有导航项 |
| 窄桌面 | 1024–1279px | 顶部导航栏导航项仍可展示，内容区自适应 |
| 平板（不重点支持）| < 1024px | 暂不处理，最小支持 1280px |

**内容区网格：**
- 绩效卡片行：4 列等宽卡片，列间距 `space-5`（20px）
- 图表区：全宽（100% 内容宽度）
- 持仓/流水表格：全宽
- 双列布局（如持仓 + 情绪卡片）：7:5 比例

### 5.3 品牌 Logo

**形态：** 当前不使用图形 Logo，品牌区仅保留文字字标。
- 字体搭配：品牌字标为「Trading Review」，使用 `font-family-serif`，34px，`font-weight: 700`，`letter-spacing: 0`，呼应 Claude Code Docs 参考图的大号衬线比例
- 后续若重新设计图形 Logo，必须先更新本节规则与 `docs/brand/` 设计资产，再接入前端组件

### 5.4 导航规则

**顶部导航栏结构（自左至右）：**
1. **第一行（全局区）**：内容最大宽度 `topbar-primary-max-width`（1400px），左侧为品牌区（「Trading Review」衬线字标 34px），右侧为「账本切换器」「上传文件」「导入历史」「设置」全局操作按钮

**账本切换器（全局组件）：**
- 位置：第一行右侧、「上传文件」按钮左侧；形态为文字下拉触发器：`[当前账本名] + lucide chevron-down(16px)`；默认账本显示「模拟数据」
- 文字 14px，`color-text-secondary`；不展示实盘/模拟徽标，不引入账本类型色
- 下拉面板（`color-surface` 白底 + `color-border-subtle` 描边 + `shadow-sm`）：仅列出全部账本名，当前项左侧 `lucide check`；不放新建/删除/管理入口
- 切换后全站数据刷新（react-query queryKey 携带 accountId）；切换中下拉禁用
2. **行间分隔线**：第一行与第二行之间使用 `1px solid color-border-subtle` 横向分隔线
3. **第二行（主导航）**：内容最大宽度 `topbar-secondary-max-width`（1400px），仅放主导航项：总览、盈亏、流水、交易意图、复盘报告、交易规则；不再包含持仓入口
4. **页面背景**：顶部导航与主内容区统一使用 `color-bg-app`，依靠细分割线和内容留白区分层级

**大模型配置表单（设置页）：**
- 标题使用「大模型配置」，不得再使用单一厂商标题如「Ollama 配置」。
- 控件顺序固定为：模型厂商 `select` → API 地址 `input` → API 密钥组合控件（仅云端/自定义显示）→ 模型 `input/select` → 「获取模型」按钮 → 保存按钮。
- 模型厂商使用原生下拉或 shadcn Select；预设厂商只改变默认值，不引入厂商品牌色，视觉仍沿用全局 token。
- API 密钥组合控件：密码输入框内右侧放 `eye/eye-off` 显隐按钮；输入框外右侧放固定宽度「检测」按钮。
- 「获取模型」按钮使用 `lucide list-restart` 或 `refresh-cw` 图标，加载时使用 `loader-2` 旋转；按钮固定宽度，成功/失败提示沿用 `color-success` / `color-danger`，提示区域允许换行且不得挤压按钮。
- API Key 已保存但未重新输入时，下方显示 `eye-off` 图标 + 「已保存密钥」，不回显明文。

**导航项状态（纯文字 + 当前页下划线）：**

| 状态 | 背景 | 文字颜色 | 图标颜色 | 字重 |
|---|---|---|---|---|
| default | 透明 | `#5e5d59` Olive Gray | `#87867f` Stone Gray | 500 |
| hover | 透明（图标/文字变色即可） | `#5e5d59` Olive Gray | `#5e5d59` Olive Gray | 500 |
| active（当前页）| 透明 + 底部 `2px` 砖红下划线 | `#141413` Near Black | — | 600 |
| focus | 同 hover + `color-focus-ring` 焦点环 | — | — | — |

第二行导航项高度占满导航行，文字 14px，默认 `font-weight: 400`，激活 `font-weight: 600`，左右内边距 16px。第一行全局操作按钮可包含 16px Lucide 图标，按钮之间用细竖线区分操作组。

### 5.5 页面内 Tab 与标题层级

**页面标题：** 每个顶层路由页面必须只有一个 H1，使用 `font-size-page-title`，位于页面内容第一行或标题工具栏左侧，左缘与内容栏起排线一致。

**页面内 Tab：**
- 用于同一页面内的同级视图切换，例如「意图列表 / 复盘统计」「已实现盈亏 / 浮动盈亏」。
- Tab 与顶部主导航共用同一套模块切换样式：14px Sans，default 400，active 600。
- Active 下划线使用 `2px solid color-primary`；底部容器保留 `1px solid color-border-subtle`。
- Tab 组不得居中；每个 Tab 左右内边距 16px，依靠文字粗细和细底线表达状态，不做大字号强调。
- 切换 Tab 时只替换下方内容区域，页面标题、Tab 组自身位置不位移。

---

## 6. 组件规范

### 6.1 按钮

**用途：** 触发操作，包括主 CTA、次操作、危险操作、图标按钮。

**结构：** `[图标（可选）] + [文字标签]`，图标在左，`space-2`（8px）间距。

**变体与样式：**

| 变体 | 背景 | 文字 | 边框 | 阴影 | 使用场景 |
|---|---|---|---|---|---|
| `primary` | `#c96442` Terracotta | `#faf9f5` Ivory | — | ring-brand | 主 CTA（保存、触发 AI 复盘、导入确认）|
| `secondary` | `#e8e6dc` Warm Sand | `#4d4c48` Charcoal Warm | — | ring（hover 时）| 次操作（取消、筛选、切换）|
| `outline` | 透明 | `#141413` Near Black | `1px #e8e6dc` | — | 三级操作（展开详情、导出）|
| `ghost` | 透明 | `#5e5d59` Olive Gray | — | — | 超轻量操作（行内链接、面包屑）|
| `danger` | `#b53333` Error Crimson | `#faf9f5` Ivory | — | — | 不可逆操作（删除标签）|
| `icon-only` | 透明 | — | — | — | 表格行内小操作（编辑、复盘）|

**尺寸：**

| 尺寸 | 高度 | Padding（水平）| 字号 |
|---|---|---|---|
| `sm` | 28px | 8px | 12px |
| `md`（默认） | 36px | 12px | 14px |
| `lg` | 44px | 16px | 15px |

**圆角：** `radius-md`（8px），统一。

**状态：**

| 状态 | 样式 |
|---|---|
| hover | 背景深一档（见 `color-primary-hover`）+ ring shadow 出现，`motion-fast` |
| active/pressed | 背景再深一档（`color-primary-active`），`scale(0.98)` |
| focus | `color-focus-ring` 2px 外环，不被 hover 覆盖 |
| disabled | `opacity: 0.45`，`cursor: not-allowed` |
| loading | 左侧显示 16px spinner，文字变为「处理中...」，按钮禁用 |

**验收标准：**
- 点击到视觉反馈 ≤ 80ms
- loading 态期间无法再次点击
- disabled 态无 hover 效果
- 所有按钮 focus ring 可见（不被 hover 样式覆盖）

---

### 6.2 输入框

**结构：** 标签（上方）+ 输入区域 + 行内错误/帮助文字（下方）。

**样式（default 态）：**
- 背景：`#ffffff`
- 边框：`1px solid #e8e6dc`（Border Warm）
- 圆角：`radius-md`（8px）
- 高度：36px
- 字号：14px，`color-text-primary`
- 占位文字：`color-text-tertiary`

**状态：**

| 状态 | 边框 | 描述 |
|---|---|---|
| default | `#e8e6dc` | 正常 |
| hover | `#d1cfc5` | 加深一档 |
| focus | `#3898ec` 2px ring（`color-focus-ring`）| 唯一冷色，无障碍焦点 |
| error | `#b53333`，行内显示错误文字（红色，12px，字段下方）| 校验失败 |
| success | `#16a34a` | 表单校验通过（少用）|
| disabled | 背景 `#f5f4ed`，文字 `color-text-disabled`，`cursor: not-allowed` | — |

**验收标准：**
- focus ring 可见，contrast ≥ 3:1
- 错误提示在字段下方（行内），不用弹窗替代
- 必填字段标签后显示 `*`（红色，`color-danger`）

---

### 6.3 表格

**用途：** 持仓列表、流水列表、盈亏明细、意图列表。

**结构：**
- 表头：`background: #f5f4ed`（Parchment），`color-text-secondary`，12px，大写或正常字重
- 表体行：`background: #ffffff`，行间 `1px solid #f0eee6` 分隔线
- 底部分页控件

**行高：**
- 流水列表（信息密度高）：`table-row-height-compact`（36px）
- 持仓列表（需扫视大数字）：`table-row-height-standard`（44px）

**列对齐规则：**
- 数字列（价格、金额、数量、盈亏）：**右对齐**，`font-feature-tabular`
- 状态列（买卖方向标签、情绪标签）：**居中**
- 文本列（股票名称、意图标签、时间）：**左对齐**

**行状态：**

| 状态 | 样式 |
|---|---|
| default | 背景 `#ffffff` |
| hover | 背景 `#f5f4ed`（Parchment），`motion-fast` |
| selected（意图录入面板打开时）| 背景 `rgba(201,100,66,0.06)`，左侧 `3px solid #c96442` 竖线 |
| 盈利行（可选强调）| 盈亏数字列 `color-profit` |
| 亏损行（可选强调）| 盈亏数字列 `color-loss` |

**空态：** 单元格区域显示居中文字提示（`color-text-tertiary`）+ 操作引导链接，无插图（保持克制）。

**骨架屏（加载态）：** 每行显示灰色矩形占位块，颜色 `#e8e6dc`，宽度随列等比，动效 `opacity 0.6 ↔ 1.0` 2s 循环。

**验收标准：**
- 所有数字列开启 `tabular-nums`，列内数字量级对齐
- 表头可点击排序时显示排序方向图标（↑↓）
- 空态文案明确（不允许空白区域）

---

### 6.4 标签 / Badge

**用途：** 交易意图标签、买卖方向标签、情绪标签。

**结构：** 圆角小胶囊，`[颜色点（可选）] + 文字`。

**通用样式：**
- 背景：`#e8e6dc`（Warm Sand）
- 文字：`#4d4c48`（Charcoal Warm），12px，`font-size-label`
- 圆角：`radius-xs`（4px）
- 内边距：`2px 8px`

**语义变体：**

| 变体 | 背景 | 文字颜色 | 用途 |
|---|---|---|---|
| 默认 | `#e8e6dc` | `#4d4c48` | 意图标签 |
| 买入 | `rgba(181,51,51,0.10)` | `#b53333` | 买卖方向「买入」（红色，A 股涨色）|
| 卖出 | `rgba(22,163,74,0.10)` | `#16a34a` | 买卖方向「卖出」（绿色，A 股跌色）|
| 划入 | `#f0eee6` | `#87867f` | 担保品划入 |
| 情绪偏多 | `rgba(181,51,51,0.10)` | `#b53333` | 大盘情绪 🔴 |
| 情绪偏空 | `rgba(22,163,74,0.10)` | `#16a34a` | 大盘情绪 🟢 |
| 情绪中性 | `#f0eee6` | `#87867f` | 大盘情绪 ⚪ |

**已选意图标签（录入面板内）：**
- default 态：Warm Sand 背景
- selected 态：`#c96442` 砖红背景，`#faf9f5` Ivory 文字

---

### 6.5 右侧滑出面板（意图录入 Drawer）

**用途：** 从流水页触发，录入交易标签、信心度、思路。

**尺寸：** 宽 400px，从顶部导航栏底部（`topbar-height: 116px`）延伸至页面底部，从右边缘滑入。

**动画：** `translateX(400px) → translateX(0)`，耗时 `motion-medium`（200ms ease），遮罩层同步 fade in（`opacity 0 → 0.3`）。

**背景与层级：**
- 面板背景：`#ffffff`
- 左侧阴影：`shadow-panel`（`-4px 0 24px rgba(20,20,19,0.08)`）
- 遮罩：`rgba(20,20,19,0.25)`，点击遮罩关闭面板
- `z-index: z-panel`（300）

**内部样式：**
- 标题栏（52px）：「编辑交易意图」`font-size-card-title`，右侧 ✕ 关闭按钮（图标 20px）
- 成交摘要区：Parchment 背景 `#f5f4ed`，内边距 `space-4`，字号 14px
- 内容区：白色背景，内边距 `space-4`
- 底部按钮区（64px）：「取消」secondary 按钮 + 「保存」primary 按钮，底部固定

**验收标准：**
- 面板打开动画 ≤ 200ms
- 遮罩可点击关闭，有未保存改动时弹确认框
- 保存成功后面板不自动关闭，顶部显示「✓ 已保存」绿色内联提示 1.5 秒

---

### 6.6 Toast 通知

**位置：** 右上角，距顶 `space-6`（24px），距右 `space-6`。

**样式：**
- 背景：`#141413`（Near Black 深色，统一格式）
- 文字：`#faf9f5`（Ivory），14px
- 圆角：`radius-md`（8px）
- 内边距：`12px 16px`
- 最大宽度：360px

**变体（图标前缀区分语义）：**
- 成功：`✓` 绿色图标，3 秒自动消失
- 错误：`✗` 红色图标，需手动关闭，或 8 秒后消失
- 警告：`!` 琥珀色图标，8 秒后消失
- 信息：`ℹ` 灰色图标，3 秒自动消失

**动效：** 从右上角滑入 `translateX(100%) → translateX(0)`，`motion-medium`。

---

### 6.7 确认弹窗（Confirmation Modal）

**用途：** 不可逆操作确认（删除标签等）。

**尺寸：** 宽 480px，居中显示，带遮罩。

**样式：**
- 背景：`#ffffff`
- 圆角：`radius-lg`（12px）
- 阴影：`shadow-modal`
- 标题：`font-size-section-title`（18px）
- 正文：`font-size-body`（14px），`color-text-secondary`
- 按钮区：右对齐，「取消」secondary + 「确认删除」danger

**验收标准：**
- 按 ESC 键关闭弹窗（等同取消）
- 确认按钮颜色为 `color-danger`（`#b53333`）
- 遮罩 `rgba(20,20,19,0.4)`

---

### 6.8 绩效摘要卡片

**用途：** 总览页顶部四卡片（总收益率、最大回撤、累计已实现盈亏、当前浮动盈亏）。

**结构（每张卡片）：**
```
┌──────────────────────────────────┐
│  标题文字（12px label）           │
│                                  │
│  主数字（28px 600 tabular-nums） │
│  副数字/单位（13px secondary）   │
└──────────────────────────────────┘
```

**样式：**
- 背景：`#ffffff`，圆角 `radius-lg`（12px）
- 边框：`1px solid #f0eee6`
- 内边距：`space-5`（20px）
- 主数字盈利：`color-profit`，亏损：`color-loss`，中性：`color-text-primary`
- 空态数字（无数据时）：`—`，`color-text-tertiary`

---

### 6.9 AI 复盘报告区

**用途：** 复盘详情页底部，流式渲染 Markdown 报告内容。

**容器样式：**
- 背景：`#faf9f5`（Ivory）
- 内边距：`space-8`（32px）
- 圆角：`radius-lg`（12px）
- 边框：`1px solid #f0eee6`

**报告内文排版：**
- 正文字体：`font-family-serif`（Georgia）
- 字号：`font-size-report-body`（16px）
- 行高：1.75
- 颜色：`color-text-primary`（`#141413`）
- H2/H3 标题：`font-family-sans`，600 weight，`color-text-primary`
- 代码块：`font-family-mono`，背景 `#f5f4ed`，内边距 `12px 16px`，圆角 `radius-sm`
- 引用块（blockquote）：左侧 `3px solid #c96442`（砖红竖线）+ 背景 `rgba(201,100,66,0.04)`

**流式输出光标：**
- 在最后一个字符后显示 `|` 闪烁光标，颜色 `#c96442`，`motion-streaming`（1s 无限循环）
- 生成完成后光标消失

**「触发 AI 复盘」按钮状态：**
- 未复盘：primary 按钮
- 生成中：loading 态（spinner + 「生成中...」文字），禁用
- 已完成：secondary 按钮「重新复盘」+ 右侧时间戳文字（`color-text-tertiary`）

---

## 7. 页面级 UI 规则

### 7.1 总览页（Dashboard）

**信息层级（优先级高→低）：**
1. 绩效摘要卡片行（P0，首屏可见）
2. 净值 vs 大盘对比图（P0，首屏主体）
3. 大盘情绪卡片（P1，首屏右侧或图表下方）
4. 文件上传区（P0，常驻但非视觉主角）
5. 导入历史（P1，下方展开）
6. 当前持仓列表（P0，总览页底部展示，替代独立持仓页）

**布局规则：**
- 绩效卡片：4 列等宽，`space-5` 列间距
- 图表与情绪：左 7 图表 + 右 5 情绪，或全宽图表 + 情绪独行
- 当前持仓列表：位于导入历史之后，使用标准表格样式，保留总持仓市值、总浮动盈亏、持仓股票数汇总行；表格行末保留「AI复盘」按钮

**首次空状态：** 上传区放大至净值图区域，显示 `radius-2xl`（24px）圆角的引导容器，背景 `#f5f4ed`，文字「上传你的第一份成交文件，开始建立复盘数据」，字号 16px Serif，副文字 14px secondary。

---

### 7.2 流水页

**主要操作位：** 顶部筛选栏（固定，sticky），表格全宽，行末操作列最右。

**重要列视觉强调：**
- 买卖方向：Badge 组件（买入绿/卖出红/划入灰）
- 意图标签：多个 Badge 横排，超出显示「+N」
- 盈亏数字：`tabular-nums`，颜色语义

---

### 7.3 复盘详情页

**Section 间分隔：** `1px solid #f0eee6` 水平分隔线 + `space-8`（32px）上下间距。

**交易摘要 Section：** 白色卡片，网格布局，字段标签 `font-size-caption` secondary，字段值 `font-size-body` primary。

**AI 报告 Section：** Ivory 背景容器，见 6.9 规范，不用卡片嵌套卡片。

---

### 7.4 交易规则页

**Markdown 编辑区：** 全宽，最小高度 60vh，右侧有「预览」切换。预览模式下正文使用 `font-family-serif` 16px，段落间距 `space-4`，H2 下方 `1px solid #f0eee6` 分隔线。

**目录侧栏：** 160px 宽，浮动在编辑区右侧或固定在左侧。章节标题 13px，`color-text-secondary`，active 章节 `color-primary`。

---

## 8. 状态与反馈

### 8.1 加载态（Loading）

- **页面级**：骨架屏（Skeleton），颜色 `#e8e6dc`，动效 `opacity 0.5 ↔ 1.0` 2s 循环，维持布局稳定
- **行情数据列**：显示 `—`，顶部显示「行情更新中...」小标（12px tertiary）
- **AI 报告生成**：见 6.9 流式输出规范

### 8.2 空态

- **一律有文案**：说明「为何没有数据」+「下一步该做什么」
- **导航引导**：空态文案中的操作链接（ghost 按钮样式）可以跳转至相关页面
- **不加大图插画**：保持克制，仅用 `icon-size-lg` 图标（24px）作视觉辅助

| 页面/模块 | 空态文案 |
|---|---|
| 净值曲线 | 导入成交数据后显示净值曲线 |
| 持仓列表 | 暂无持仓数据。导入成交记录后将自动计算 |
| 流水列表 | 暂无成交记录 |
| 意图列表 | 还没有意图记录。在流水页点击任意成交开始添加 |
| 盈亏统计 | 暂无足够数据。完成几笔完整买卖后再来看 |
| 导入历史 | 暂无导入记录 |

### 8.3 错误态

- **行情获取失败**：页面顶部黄色 Banner（`color-warning` 背景淡化版），文字说明原因 + 「重试」链接
- **操作失败**：右上角 Toast（`error` 变体）
- **文件解析失败**：上传区内联红色 Banner，不跳页
- **大模型连接失败**（Ollama 或云端 API）：AI 报告 Section 内联红色 Banner + 「去设置」跳转链接；文案区分地址/网络失败与 API Key 鉴权失败

Banner 样式：
- 背景：`rgba(181,51,51,0.06)`
- 左侧 `4px solid #b53333` 竖线
- 文字：`color-text-primary`，14px
- 可关闭按钮（✕，右侧）

### 8.4 禁用态

- `opacity: 0.45`，`cursor: not-allowed`
- 不加 Tooltip 除非原因不显而易见
- 禁用期间按钮不响应 hover

### 8.5 成功态

- 操作成功：Toast（success 变体，3 秒自动消失）
- 保存意图成功：面板内顶部「✓ 已保存」行内绿色提示，1.5 秒后消失
- 文件导入成功：页面内联摘要卡片（见 UX.md 2.3）

---

## 9. 可访问性与可用性

### 9.1 对比度与可读性

- 主文字（`#141413` on `#ffffff`）：对比度 ~20:1 ✓
- 次文字（`#5e5d59` on `#ffffff`）：对比度 ~7.4:1 ✓
- 最小文字（`#87867f` on `#ffffff`）：对比度 ~3.2:1，仅用于辅助性非关键文本 ✓
- 砖红（`#c96442`）on 白色：对比度 ~3.4:1，**仅用于 UI 组件级元素（按钮、图标），不用于正文** ✓
- 警告色（`#d97706`）on 白色：对比度 ~3.0:1，**必须配合文字说明，不单靠颜色** ⚠

### 9.2 焦点与键盘可达

- 所有可交互元素必须有可见 focus ring：`2px solid #3898ec`（`color-focus-ring`），outline-offset: 2px
- focus ring 不被 hover 背景色覆盖
- 侧边栏导航、表格操作列、表单、弹窗支持 Tab 键顺序导航
- 弹窗打开时 focus 锁定在弹窗内（焦点陷阱），关闭后返回触发元素

### 9.3 状态表达

- 盈亏颜色（绿/红）**必须**配合 `+/-` 符号，不单靠颜色区分正负
- 买卖方向 Badge **必须**有文字（「买入」/「卖出」），不只靠颜色
- 错误态输入框**必须**有行内文案说明原因，不只靠红色边框
- 图表**必须**有图例文字标注（曲线名称）

---

## 10. 非目标与边界

- **不定义**：颜色选择器、移动端触控适配、iOS/Android 平台组件
- **不选型**：前端框架、组件库（shadcn、Ant Design 等）→ 交由 dev-kickoff
- **不包含**：动效代码实现、CSS 变量具体写法 → 交由 frontend-dev
- **不重写**：UX 流程、PRD 功能需求

---

## 11. 开放问题与假设

| # | 状态 | 问题 | 假设/待定 |
|---|---|---|---|
| UI-1 | 开放 | 是否需要支持暗色模式？ | 当前仅定义浅色模式；暗色模式作为后续迭代，预留 token 命名语义化（如 `color-bg-app` 而非 `color-ivory`）|
| UI-2 | 开放 | 图表库选型（ECharts/Recharts/D3）？ | 由 dev-kickoff 决定；本规范提供 token 值，图表库实现不影响视觉规范 |
| UI-3 | 开放 | Markdown 编辑器（规则页）是否需要所见即所得工具栏？ | 当前假设支持「编辑/预览」Tab 切换，不加工具栏（保持克制）|
| UI-4 | 假设 | Anthropic Serif 字体资产 | 字体栈优先使用 `Anthropic Serif`；若运行环境没有该字体或缺少中文字形，依次降级到 `Noto Serif SC`、Georgia、系统 serif |
| UI-5 | 假设 | 图标库使用 Lucide（线性风格，MIT 授权）| 可在 dev-kickoff 阶段确认 |

---

## 12. 变更记录

| 日期 | 类型 | 内容 | 原因 | 影响范围 |
|---|---|---|---|---|
| 2026-05-29 | 新建 | 初版，覆盖 Web 桌面端全量 UI 规范 | 项目 UI 设计启动，参考 Claude 设计系统 | 全局 |
| 2026-05-30 | 变更 | 布局从左侧竖向侧边栏（220px）改为顶部横向导航栏（64px） | 用户反馈侧边栏字体小、选中态文字不可见；顶部导航更符合桌面效率工具规范 | 5.1 页面框架、5.2 断点、5.3/5.4 导航规则、4.3 间距 Tokens、6.5 Drawer |
| 2026-05-30 | 新增 | 曾尝试品牌图形 Logo 方向，后续已移除 | 用户要求有专属品牌 Logo | 5.3 品牌 Logo |
| 2026-05-30 | 变更 | 品牌字标改为「Trading Review」大号衬线样式 | 用户要求让字标使用参考图比例与字体方向 | 4.2 字号层级、5.3 品牌 Logo、5.4 导航规则 |
| 2026-05-30 | 变更 | 全局基础字号从 14px 升至 16px（html font-size） | 用户反馈整体字体过小，层级不清晰 | 4.2 字号层级（基础字号说明） |
| 2026-05-30 | 变更 | content-padding-x: 32px → 40px，content-padding-y: 32px → 36px | 顶部导航布局下内容区呼吸感调整 | 4.3 间距 Tokens |
| 2026-05-30 | 变更 | 顶部导航重构为 Claude Code Docs 式双行结构；第一行放品牌与设置/上传/导入历史，第二行放主导航；持仓页入口移除，持仓列表并入总览页底部 | 用户要求按 code.claude.com/docs/zh-CN/cli-reference 的顶部布局重构，并删除独立持仓页 | 4.3 间距 Tokens、5.1 页面框架、5.4 导航规则、7.1 总览页 |
| 2026-05-30 | 变更 | 移除当前牛牛图形 Logo 及相关展示资产，品牌区暂回纯文字字标 | 用户反馈当前 Logo 不符合预期，要求删除并不再沿用该方向 | 5.3 品牌 Logo、5.4 导航规则、Topbar |
| 2026-05-30 | 变更 | 写入严格左对齐与文字层级规范：品牌、主导航、页面标题、页面内 Tab 共用内容栏左起排线；新增 L0-L6 文字层级与 Tab 切换模式；顶部两行 max-width 统一为 1400px | 用户反馈当前页面没有左对齐，要求参考 Claude Code Docs 排版但保留自有主题色 | 4.2 文字 Tokens、4.3 布局 Tokens、5.1 页面框架、5.4/5.5 导航与 Tab |
| 2026-05-30 | 变更 | 将顶部主导航和页内 Tab 统一为原「意图列表 / 复盘统计」的细横条样式：14px、default 400、active 600、2px 砖红下划线、16px 左右内边距 | 用户反馈上一版导航与 Tab 过粗，原样式更细、更有质感，并要求上方功能模块同步 | 4.2 文字 Tokens、5.4 导航规则、5.5 页面内 Tab |
| 2026-05-30 | 变更 | 标题衬线字体栈改为 `Anthropic Serif` 优先，保留 `Noto Serif SC` 与 Georgia 降级 | 用户要求标题使用 Anthropic Serif | 4.2 文字 Tokens、UI-4、前端字体配置 |
| 2026-05-30 | 新增 | 设置页新增资金记录面板：默认摘要展示累计净入金，按钮展开后显示金额输入框、入金/出金按钮和可删除记录列表；沿用现有 surface、border、primary、profit/loss token | 用户确认用出入金记录作为收益率与回撤的本金口径 | 设置页 |
| 2026-05-30 | 新增 | 顶栏第一行新增「账本切换器」全局组件（当前账本名 + 实盘/模拟徽标 + chevron 下拉，下拉列账本含 check 与「新建/管理」入口，切换刷新全站）；§5.1 框架图与 §5.4 导航规则同步；徽标复用 chip/pill 规范不引入新色 | 落地 PRD 4.7 多账本（账户切换） | §5.1、§5.4 |
| 2026-05-30 | 调整 | 明确顶栏账本切换器放在「上传文件」按钮左侧，全局按钮顺序调整为「账本切换器 / 上传文件 / 导入历史 / 设置」 | 用户指定账本切换按钮位置 | §5.4 |
| 2026-05-30 | 简化 | 账本切换器改为仅显示账本名与 chevron，下拉仅切换账本；移除实盘/模拟徽标与下拉内新建/管理入口，账本管理移至设置页 | 用户要求多账本只记录账本名 | §5.4 |
| 2026-05-30 | 变更 | §8.3 错误态「Ollama 连接失败」改为「大模型连接失败」，区分地址/网络与 API Key 鉴权失败文案 | 大模型扩展为 Ollama/云端 API 双来源 | §8.3 |
| 2026-05-30 | 变更 | 总览净值图改版为「收益率走势」：纵轴百分比、0% 居中（`#d1cfc5` 实线基线），区间起点归一为 0%；新增多基准对比线配色（上证 `#a07e5a`、深证成指 `#7d8a6a`、创业板指 `#9a7aa0`，账户保持 `#c96442`）与底部基准 chips；时间区间 pills + 筛选、收益率口径下拉沿用现有 surface/border/primary token；绩效卡「已清仓已实现盈亏」→「总盈亏」 | 用户要求按券商收益率页排版（保留品牌色）并支持日期筛选、卡片改总盈亏 | 6.x 图表色系、绩效摘要卡片 |
| 2026-05-30 | 变更 | 绩效摘要卡「总盈亏」→「总盈亏（不含手续费）」；与收益率走势「累计收益」全部区间同口径 | 用户要求改文案并与累计收益一致 | 绩效摘要卡片 |
| 2026-05-30 | 变更 | 收益率走势卡片移除收益率口径下拉，头部固定「收益率」文字标签 | 三口径切换仅改头部数字、曲线不变，易误导 | 收益率走势卡片 |
| 2026-06-01 | 修正 | 资金记录金额展示改为完整人民币金额：累计净入金与单条入金/出金不使用「万/亿」缩写 | 用户要求入金展示具体数字，不要四舍五入成「万」 | 设置页资金记录 |

| 2026-05-31 | 变更 | 全局涨跌颜色统一为 A 股惯例「红涨绿跌」：color-profit #b53333（红）、color-loss #16a34a（绿），对调原有 token 值；修复 Dashboard 累计收益/收益率/基准收益率的绕路变量引用；买入/卖出 Badge 背景色同步修正；错误提示改用 color-danger | 原 color-profit=绿、color-loss=红（西方惯例），导致顶部卡片绿涨、底部指数红涨不一致 | §4.1 语义色、§6.4 Badge、Dashboard |
