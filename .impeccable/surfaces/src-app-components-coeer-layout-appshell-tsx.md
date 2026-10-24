---
version: 2
slug: "src-app-components-coeer-layout-appshell-tsx"
primary_target: "src/app/components/coeer/layout/AppShell.tsx"
related_targets: ["src/app/styles/app.css", "src/app/components/coeer/layout/Sidebar.tsx", "src/app/components/coeer/layout/CommandMenu.tsx", "src/app/components/coeer/feedback/Modal.tsx", "src/app/components/coeer/feedback/Toast.tsx", "src/app/routes/index.tsx"]
---

# 全站外壳与浮层设计契约

Contract: `coeer-glass-v1` · 更新：2026-10-24。

Mode: Implemented. 上述目标文件已接入统一令牌、Chrome/Floating 材质与不透明回退，保留现有路由和业务能力。验证范围见[实施记录](../implementation-review.md)。

## Direction contract

THESIS: 学生在全宽工作区浏览社区、完成服务任务并追踪真实进度。导航与覆盖层通过克制玻璃材质表达空间关系，正文保持实底和稳定阅读。

OWN-WORLD: 低饱和紫灰画布，最多两处静态柔和渐变；Chrome 侧栏/顶栏、Floating 浮层采用半透明填充、背景模糊、1px 细高光与轻阴影；Reading 内容表面不透明、无 blur。深浅主题消费相同语义令牌，首次默认浅色。Inter 与中文系统无衬线字体、小尺寸工具控件和行式信息结构继续沿用。

STORY: 先定位模块，再筛选和阅读，最后参与/提交并持续查看真实结果。页面导航搜索保留 Cmd/Ctrl+K 和键盘操作，仅匹配现有页面名称与路径，不扩展为全站内容搜索。真实空状态给出当前权限下可用的下一步。

FIRST VIEWPORT: viewport ≥1024px 显示贴边 224px 侧栏，sticky 顶栏 52px。全宽 PageLayout 占满剩余区域，桌面左右 32px、手机 16px。标题、操作、模块导航、筛选和主体共用边界；不设工作区最大宽度，不额外包裹漂浮窗口。阅读长度只在正文/字段内部控制。窄屏切换为可关闭的原生 dialog 导航抽屉，宽 `min(288px, 86vw)`。

FORM: 当前用户明确的毛玻璃方向取代历史 Linear 平面材质约束；沿用清晰导航、紧凑工具栏和列表组织。颜色与材质数值以 [design.json](../design.json) 为准，布局、组件、业务展示与降级规则以 [UI/UX 规范](../ui-layout.md) 为准，不保留随机 seed 或历史挑战方向作为后续设计要求。

## 外壳实施边界

- 画布只定义一次，检查 AppShell 现有实色外层是否遮住渐变。侧栏/顶栏使用同一 Chrome 材质，贴边处保留分界，不加外边距和大型圆角。
- 背景使用固定视口的单层渐变；游客页头 64px、sticky 顶距 0，不能在滚动后丢失唯一玻璃区域。验收必须确认实际透色和模糊可感知，不只检查 CSS 属性。
- 顶栏放面包屑、现有通知入口、页面搜索；面包屑显示可读名称，不显示数据库 ID。管理区继续显示真实管理导航与返回社区入口。
- 侧栏导航区独立滚动，品牌、搜索及底部主题/用户入口可达。主题与通知沿用现有能力，不增加虚构统计或新的后端能力。
- Modal、抽屉、命令菜单和 Toast 用 Floating；其中长文、裁剪与表单内区实底。不将 Card 默认变成玻璃。
- 桌面常驻 blur 区域最多 2、临时含浮层最多 3；触屏/小屏最多 2，blur 降至 8px。抽屉与命令菜单互斥，不在遮罩上 blur。
- 原生 dialog 的 top layer 优先于普通 z-index；模态任务反馈在模态内可见。所有浮层保留可见标题/名称、焦点进入和返回、Esc、滚动锁与正确的内外点击判定。
- 无 backdrop 支持、减少透明、高对比或性能超预算时使用不透明 sidebar/overlay。布局、主题、键盘和任务功能不依赖 blur。

## Finish review

文档检查范围：统一方向、同步令牌与 DESIGN.md、清除全宽/固定上限和平面/玻璃规则冲突、保留业务约束。已按[分阶段计划](../refactor-plan.md) 完成代表页面截图、对比度、主题/移动尺寸/键盘/降级与实验室性能验证；实体手机和其他浏览器尚未覆盖。

Verdict: 前端已接入，Chromium 代表页面通过；跨平台和生产指标待后续验证。未新增产品位图资产，未执行部署。
