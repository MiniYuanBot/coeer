# COEER

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
学院学生使用社区、反馈与成长服务；moderator 与 admin 承担现有代码定义的管理工作。用户已确认产品定位与本次全站界面重构范围。

## Product Purpose
将群组和帖子、反馈处理、公告订阅、活动报名、宿舍服务与积分成长集中在同一个学院社区中。

## Capabilities and Constraints
保留现有路由、登录与权限、服务器接口、真实内容和业务流程。使用现有 React 19、TanStack Start、TypeScript 与 Tailwind CSS 4 实现，支持桌面和移动浏览器。未增加通知、搜索索引等尚未存在的后端能力。

## Brand Commitments
保留 COEER 名称和中文界面。用户指定参考 Linear；浅色默认，保留深色切换。全站公共组件、导航与主要页面统一重构。

## Evidence on Hand
README.md、docs/schema.md 和现有 routes、shared/contracts、server/services 定义产品能力。数据库内容和既有种子内容是真实展示来源；不在正式页面伪造统计、活动或动态。

## Product Principles
- 让学生快速找到内容、查看进度并完成任务。
- 导航、筛选、状态与主要操作在页面间保持一致。
- 以真实业务状态呈现加载、错误和空内容。
- 保持键盘操作、移动端导航和主题切换可用。
