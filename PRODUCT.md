# COEER

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
学院学生使用社区、反馈与成长服务；moderator 与 admin 承担现有代码定义的管理工作。

## Product Purpose
将群组和帖子、反馈处理、公告订阅、站内通知与收藏、活动报名、空间预约、宿舍服务与积分成长集中在同一个学院社区中。

## Capabilities and Constraints
保留现有路由、登录与权限、服务器接口、真实内容和业务流程。使用现有 React 19、TanStack Start、TypeScript 与 Tailwind CSS 4，支持桌面和移动浏览器。站内通知、收藏与页面导航搜索已有实现；页面搜索只匹配页面名称与路径，不代表全站内容检索，不新增搜索索引等后端能力。

全站布局、材质与交互遵循 [UI/UX 规范](.impeccable/ui-layout.md)。展示层重构应保持预约异步处理、状态、轮询与权限语义；业务规则和升级要求见[社区功能](docs/community-updates.md)。

仅管理员可删除未被收藏的卡片；已有收藏的卡片允许通过权重 0 移出奖池，不能级联清除用户收藏。隐藏卡片与成就仅对已获得的用户可见。

## Brand Commitments
保留 COEER 名称和中文界面；浅色默认，保留用户选择的深色主题。当前视觉方向为低饱和紫灰背景与柔和静态渐变，导航与浮层使用受控毛玻璃，正文实底保持可读。全宽工作区、紧凑导航与清晰列表延续现有结构，兼容移动端、键盘操作和效果降级。此方向取代历史 Linear 平面材质要求，具体规范见 [DESIGN.md](DESIGN.md) 与 [.impeccable/ui-layout.md](.impeccable/ui-layout.md)。

## Evidence on Hand
README.md、docs/schema.md 和现有 routes、shared/contracts、server/services 定义产品能力。数据库内容和既有种子内容是真实展示来源；不在正式页面伪造统计、活动或动态。

## Product Principles
- 让学生快速找到内容、查看进度并完成任务。
- 导航、筛选、状态与主要操作在页面间保持一致。
- 以真实业务状态呈现加载、错误和空内容。
- 保持键盘操作、移动端导航和主题切换可用。

收藏支持按现有帖子类型（公告／讨论）筛选，并搜索收藏内容的标题、正文和群组名称；服务端在账号与内容权限过滤后分页，不扩展收藏对象种类。
