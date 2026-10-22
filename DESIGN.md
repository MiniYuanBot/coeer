---
name: "COEER"
description: "以 Linear 产品界面为参考的学院社区工作区；浅色默认，可切换深色。"
colors:
  background: "hsl(0 0% 100%)"
  foreground: "hsl(240 6% 15%)"
  card: "hsl(0 0% 100%)"
  card-foreground: "hsl(240 6% 15%)"
  sidebar: "hsl(240 14% 97%)"
  muted: "hsl(240 8% 96%)"
  muted-foreground: "hsl(240 4% 43%)"
  border: "hsl(240 7% 90%)"
  ring: "hsl(243 48% 56%)"
  primary: "hsl(243 48% 56%)"
  primary-foreground: "hsl(0 0% 100%)"
  primary-soft: "hsl(243 55% 96%)"
  success: "hsl(158 64% 30%)"
  warning: "hsl(35 90% 32%)"
  danger: "hsl(0 65% 46%)"
  inverted: "hsl(240 6% 15%)"
  inverted-foreground: "hsl(0 0% 100%)"
  dark-background: "hsl(240 7% 10%)"
  dark-foreground: "hsl(240 5% 92%)"
  dark-card: "hsl(240 6% 12%)"
  dark-card-foreground: "hsl(240 5% 92%)"
  dark-sidebar: "hsl(240 7% 8%)"
  dark-muted: "hsl(240 5% 16%)"
  dark-muted-foreground: "hsl(240 5% 64%)"
  dark-border: "hsl(240 5% 21%)"
  dark-ring: "hsl(243 75% 73%)"
  dark-primary: "hsl(243 75% 73%)"
  dark-primary-foreground: "hsl(240 12% 12%)"
  dark-primary-soft: "hsl(243 25% 18%)"
  dark-success: "hsl(158 48% 58%)"
  dark-warning: "hsl(38 85% 65%)"
  dark-danger: "hsl(0 76% 70%)"
  dark-inverted: "hsl(240 5% 92%)"
  dark-inverted-foreground: "hsl(240 7% 10%)"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "15px"
    fontWeight: 500
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    fontFeature: "'cv02', 'cv03', 'cv04', 'cv11'"
  copy:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "24px"
  field:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  caption:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "16px"
rounded:
  sm: "4px"
  nav: "5px"
  md: "6px"
  lg: "8px"
  dialog: "10px"
  xl: "12px"
spacing:
  "4": "4px"
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "32": "32px"
  "40": "40px"
components:
  button-primary:
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
  button-secondary:
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
  button-outline:
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
  button-ghost:
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
  button-danger:
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
    backgroundColor: "{colors.danger}"
    textColor: "{colors.primary-foreground}"
  button-danger-dark:
    backgroundColor: "{colors.dark-danger}"
    textColor: "{colors.dark-background}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  search-input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.field}"
    rounded: "{rounded.md}"
    padding: "0 12px 0 32px"
    height: "36px"
  navigation-link:
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.nav}"
    padding: "7px 10px"
  badge-primary:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
  feedback-row:
    textColor: "{colors.foreground}"
    padding: "12px 12px"
---

# Design System: COEER

## Overview

**Creative North Star: "学院社区工作区"**

COEER 采用用户指定的 Linear 产品界面语言：白色内容面、冷灰侧栏、石墨文字与低饱和紫色主操作。页面保持紧凑、清晰和克制，让学生在同一工作区浏览社区内容、跟进反馈并完成服务任务。

浅色是首次访问的默认主题，深色使用相同语义令牌切换为石墨画布。Inter 与中文系统无衬线字体共同承担界面排版；分隔线、状态图标、精简徽章和真实内容构成页面，组件形态由现有代码统一约束。

**Key Characteristics:**
- 紧凑侧栏、路径栏与左对齐内容区。
- 低饱和紫色用于主操作、焦点和进行中状态。
- 细边框、小圆角、平面层级；列表通过对齐和分隔线组织。
- 浅色默认、深色可切换；键盘焦点和移动抽屉保持可用。

依据 `PRODUCT.md`、已确认的界面方向与当前源代码整理。主要实现位于 `src/app/styles/app.css` 以及 `components/coeer`；工作区首页、反馈列表、认证入口提供实际应用示例。界面图形使用现有 CSS 与内联 SVG，本次未生成或新增 raster 视觉资产。

## Colors

中性底色承担大部分面积，紫色集中在操作与当前状态；成功绿、待处理琥珀色与错误红保留各自语义。规范值位于 frontmatter，沿用源代码的 HSL 表达。

### Primary

- **协作紫（primary / ring）**：主按钮、选中导航图标、链接、焦点和处理中状态。
- **紫色浅底（primary-soft）**：主题内的轻量强调底色、头像与主色徽章；文字使用 primary。
- **主操作文字（primary-foreground）**：适配当前主题的按钮文字。

### Neutral

- **内容画布（background / foreground）**：页面与主要文字；深色切换到石墨画布和浅灰文字。
- **独立表面（card / card-foreground）**：卡片、弹窗和命令菜单。
- **冷灰侧栏（sidebar）**：稳定的导航区域，与内容面形成轻微色差。
- **辅助层（muted / muted-foreground）**：筛选选中背景、悬停层和日期、描述等辅助文字。
- **细分界（border）**：卡片边框、页面分隔线和表单边界。
- **反相对比（inverted / inverted-foreground）**：现有业务页面使用的主题兼容对比令牌。

### Semantic states

success 表示已完成，warning 表示待处理，danger 表示错误或危险操作。反馈行还使用描边圆、半填充圆、对勾和叉号区分状态。frontmatter 中的 `dark-*` 是 `.dark` 对应的实际覆写值；两种主题均通过同一语义角色消费，不通过页面局部改色实现。

**The Semantic Color Rule.** 主操作与进行中状态使用 primary；成功、待处理和错误沿用独立语义色，并配文字或图形表达状态。

## Typography

**Display Font:** Inter，中文回退 PingFang SC / Microsoft YaHei，再回退系统 sans-serif。
**Body Font:** 与 display 相同；拉丁字符开启 cv02、cv03、cv04、cv11 特性。

Inter 是已确认 Linear 界面方向的一部分；不新增第二套展示字体。日期、表格和积分数值使用等宽数字。

### Hierarchy

- **Display**：游客首页主介绍；手机使用 frontmatter 的 display，sm 起增至（44px），保持（1.35）行高。
- **Headline**：工作区页面标题，紧凑字距与（1.25）行高；认证标题使用（25px）的局部变体。
- **Title**：帖子、群组、活动等内容标题；部分章节标题使用（14px / 600）。
- **Body**：基础界面文字。常见说明文案采用 copy，页面介绍最多（70ch）。
- **Field / Label**：field 用于搜索字段，label 用于按钮与短操作；筛选与辅助标签也使用（12px）。
- **Caption**：徽章、日期和元信息；避免让其承担正文阅读。

**The Task Hierarchy Rule.** 产品页标题、操作标签与辅助信息按已有角色分级；首页公开介绍的 display 字号不扩散到工作区列表。

## Layout

桌面在 lg（1024px）起固定左侧导航（224px），内容区上方为（52px）sticky 路径栏。`--sidebar-width`、`--workspace-gutter` 与 `--workspace-width` 统一控制外壳尺寸；桌面左右各留（32px），内容最大（1440px），上下内边距为（28px / 64px）。路径栏、页面标题、筛选和内容共用左边界。

`PageLayout` 提供 full、reading（896px）、form（704px）三种宽度，均左对齐；列表使用完整画布，详情限制阅读长度，填写任务限制字段长度。分区间距统一（24px）。`SectionHeader` 用两列网格排列标题与操作，说明位于下一行；手机上说明占满整行，日期字段另起一行。群组内的子页面使用 h2，避免重复的页面主标题。

包含辅助信息的详情和填写任务可采用 `.coeer-detail-page`（最大 1200px）配合 `DetailLayout`：内容区达到 880px 时，正文与 280px 辅助栏并排，更窄时顺序堆叠。正文限制约 76ch，避免为填满画布而拉长文本。活动可将时间、地点和报名在窄屏上排到说明前；帖子信息和反馈提示排在主要内容后。多按钮的页面头使用 `actionLayout="stack-on-mobile"`，在可用宽度小于 640px 时将操作独立成行。

手机低于（640px）时，工作区与公开页容器保留左右各（16px）空隙，工作区上下内边距为（24px / 48px）。lg 以下使用顶部导航触发器和原生 dialog 抽屉，抽屉宽度为 `min(288px, 86vw)`。sm（640px）起反馈行显示独立的状态、日期列；更窄时它们进入标题下方元信息行。

登录首页在内容区达到（880px）时使用弹性主栏和（264px）信息侧栏，栏间距（32px），侧栏以细线分隔并保留（24px）内边距；更窄时顺序堆叠。集合网格使用 `.coeer-grid`，按内容区自动排列最小（280px）的列，避免桌面侧栏挤压三列卡片。游客首页保留品牌、主题切换和登录/注册的（64px）页头，公开介绍与动态左对齐；公开信息侧栏为（300px）。认证页保持最大（340px）的居中表单。

空间以现有的（4px）节奏为主，紧凑控件也使用（6px / 10px / 14px）微调。内容块通常间隔（24px / 32px / 40px）；卡片本身不规定统一内边距，由用途采用（16px / 20px）。

## Elevation & Depth

公共组件没有投影令牌。卡片、提示与列表以表面色、细边框和分隔线呈现层级；hover 改色，不上浮。弹窗、导航抽屉与命令菜单使用原生 dialog 的遮罩（`rgb(18 18 24 / .35)`），以覆盖关系建立前后层次。

**The Flat Surface Rule.** 卡片与列表在默认状态保持平面，以边框、分隔线和表面色组织层级；悬停仅改变颜色。

交互颜色通常在（120ms ease-out）内切换，按钮使用（150ms）颜色过渡。加载条、加载旋转只表达真实 pending 状态；路由进度条与反馈更新提示在 hydration 后启用。系统减少动态效果时，动画和过渡被缩短至（0.01ms）。

## Shapes

控件使用轻微圆角（6px），侧栏导航使用（5px），普通容器与 Modal 使用（8px），命令菜单使用（10px）。徽章和键帽使用（4px）；空状态图标框使用（12px）。头像、状态圆与进度条端点保留圆形形态，它们不改变普通容器的小圆角规则。所有普通边框为（1px）。

## Components

### Buttons

紧凑、清晰的任务操作。默认高度（36px）、水平内边距（14px）；sm 为（32px / 10px），lg 为（44px / 20px），icon 为（32px）正方形。文字采用 label，圆角采用 md。

primary 用主色实底；secondary 用 card 与细边框；outline 透明底带边框；ghost 透明底加弱文字；danger 用错误色。hover 使用透明度或 muted 背景变化。focus-visible 使用 ring 的（2px）描边与（3px）间隙。disabled 降至（50%）不透明度，loading 保留标签、显示旋转标记、禁用重复提交并暴露 aria-busy。手机按钮最小高度（44px）。表单先放取消，再放提交，操作靠右。

### Chips

Badge 是（11px）短状态标签，内边距（2px 6px），边框（1px）。primary 使用浅紫底；success、warning、danger 使用各自颜色的轻透明底与边框。筛选按钮采用（32px）最小高度、muted 选中底色与 aria-pressed；反馈范围切换以底部主色线表示当前范围。

Badge 不换行、不收缩，避免“已通过”等短状态被挤成多行。`FilterPanel` 的搜索组宽度上限（288px），与筛选组按可用空间并排或换行；手机搜索独占一行，筛选按钮最小高度（40px）。`NavTabs` 使用一致的下划线激活态，超出宽度时只滚动导航自身。

### Cards / Containers

Card 提供表面、细边框与 lg 圆角，不内置投影或内边距。内容卡常用（20px），信息侧栏卡常用（16px）。首页信息流将 PostCard 的外框和圆角清除，以分隔线、上下留白组织连续内容；不要把这种列表重新包成逐条卡片。

首页按“官方公告 → 最新动态 → 近期反馈”排列，每个板块各有细边框和浅色标题栏，板块之间间隔（24px），各展示最多 5 条，不在首页分页。公告置顶优先；公告和每个群组的帖子分别最多置顶 5 条。最新动态将活动与已审核公开群组的帖子按发布时间倒序混排，忽略群组置顶，不展示回复或回复输入框。内容标题统一（15px），正文使用 body；长公告和动态默认限制（140px）高度，底部渐隐，可展开全文。首页点赞、收藏使用 xs 按钮：桌面高度（28px）、文字（12px）、图标（14px），手机仍保留（44px）的最小点击高度。

### Inputs / Fields

SearchInput 高度（36px），圆角 md，background 底与细边框；前置搜索图标、左内边距（32px）与右内边距（12px）。认证字段高度（44px）、水平内边距（12px），标签置于字段上方。placeholder 使用 muted-foreground；focus-visible 同时保留可见 ring 和主色边框。错误提示采用 danger 文字、轻透明底与边框，并保留 alert 语义。

手机输入框、选择器和文本域使用（16px）文字，输入框和选择器最小高度（44px），保留浏览器缩放。管理表单使用持久标签，切换编辑对象时重建非受控字段，确保显示值对应当前对象。个人中心采用 `.coeer-settings-section` 分区，内容区达到（720px）后将说明与字段分为两栏。

### Navigation

侧栏链接最小高度（34px），内边距（7px 10px），图标与文字间隔（10px）。默认弱文字；hover 使用 foreground 的（4%）背景，active 使用（6.5%）背景、（550）字重与主色图标。侧栏含品牌、页面搜索、分组导航与底部主题/用户区。主图标默认（16px）；上下文可使用（14px）。

手机侧栏链接最小高度（44px）。进入管理后台后，导航区显示管理模块与“返回学院社区”，用户与主题区仍固定于底部。路径栏展示可点击父级及当前页面，不直接显示数据库 ID。

### Feedback rows

反馈列表按状态图标、内容、状态徽章、提交日期排列，桌面列宽为 `20px minmax(0, 1fr) 84px 64px`，列间距（12px），上下留白（12px）。整行可进入详情，hover 使用 muted 的（50%）底色，标题改为 primary。手机保留图标与内容两列，将状态、日期移至内容元信息；简介最多两行，桌面最多一行，行间用细线分隔。

### Shared data surfaces

`StatsBar` 用一个有分隔线的容器呈现同类真实数值，避免大块图标与重复卡片抢占层级。`MediaPreview` 限制集合图片高度；缺图或加载失败时以中性图标占位，不留下破图标记。`TableScroll` 将表格横向滚动限制在容器内；内容超宽时提供滚动提示与键盘焦点。个人中心不显示写死的群组、反馈或成就数量。

### Dialogs and command menu

Modal 使用带标题关联的原生 dialog，宽度最多（512px）、距视口至少（16px），内边距（20px），内容超高可滚动。Esc、关闭按钮和真正位于弹窗边界外的遮罩点击关闭；点击弹窗内边距保留打开。开启时锁定背景滚动。

页面搜索是导航命令菜单，由 Cmd/Ctrl+K 或搜索按钮触发。宽度最多（560px），桌面顶距（16vh），手机（10vh）；支持输入过滤、方向键选择、Enter 跳转和 Esc 关闭。点击菜单内部留白保留打开，真正点击外部遮罩才关闭。它按现有页面名称与路径过滤，不代表全站内容搜索能力。

### Empty states and notifications

空状态采用小图标框、明确标题、说明与适用的下一步按钮。Toast 沿用 Card 和语义 Badge，位于右下角；加载、失败、无数据均使用真实状态。开发工具及早期截图中 hydration 前的进度条残影不属于组件规范。

## Do's and Don'ts

### Do:
- **Do** 使用语义颜色和已有组件扩展页面，保持两种主题一致。
- **Do** 让页面标题、主操作、筛选与内容遵循清晰的任务顺序。
- **Do** 在手机上让筛选换行，并将反馈的状态、日期收进内容区。
- **Do** 为交互保留可见焦点、可访问名称与键盘操作。
- **Do** 用真实数据和明确空状态表达业务结果。

### Don't:
- **Don't** 为普通卡片增加装饰性投影或悬浮位移。
- **Don't** 将所有内容改成独立大卡片；已有信息流与反馈列表使用行和分隔线。
- **Don't** 用颜色单独表达状态，或移除状态文字与图形。
- **Don't** 为界面填充虚构统计、内容或尚未存在的业务入口。
