---
version: 1
slug: "src-app-components-coeer-layout-appshell-tsx"
primary_target: "src/app/components/coeer/layout/AppShell.tsx"
related_targets: ["src/app/styles/app.css","src/app/routes/index.tsx","src/app/routes/_authed/feedbacks/index.tsx"]
---

# 全站产品界面

Mode: Operate. Scope: 应用外壳、公共组件、首页、反馈列表与登录入口；其余业务页继承统一组件和主题。

## Direction contract

THESIS: 学生在同一工作区找到社区内容与服务并追踪反馈。用户指定 Linear，以紧凑导航、清晰工具栏和横向反馈列表替换重复卡片堆叠。

OWN-WORLD: 白色内容面、冷灰侧栏、石墨文字、低饱和紫色主操作；深色为石墨工作区。Inter 用于产品界面，中文使用系统无衬线字体。细边框、小圆角控件、克制徽章。

STORY: 进入社区后先定位当前模块，再筛选内容、阅读状态并完成提交或参与。真实空状态保留明确下一步，不添加虚构数据。

FIRST VIEWPORT: 桌面左侧 232px 导航，顶部 52px 路径栏，内容区左对齐。页面标题和主操作同排；筛选栏贴近内容。首页主内容配精简信息侧栏。反馈采用状态图标、标题、分类与日期对齐的列表。手机变为单列与可关闭抽屉。签名交互是可搜索的页面导航，支持 Cmd/Ctrl+K、键盘选中和 Escape 关闭。

FORM: Linear 产品惯例由用户在原始请求中指定，优先于 seed 1d0f8268 的随机方向。直接代码实现已确认；未采用网络不可用时缺席的挑战方向或质量参考板。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
