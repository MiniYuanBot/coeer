# COEER

面向学院与组织的社区平台，提供群组交流、意见反馈、公告与活动、积分与收藏，以及宿舍分配和空间预约。

> [开发环境](docs/development.md) · [架构约定](docs/schema.md) · [社区功能](docs/community-updates.md) · [空间预约](docs/open-space.md) · [部署运维](docs/deployment.md) · [检查命令](docs/testing.md)

## Tech Stack

| 层级 | 技术 |
| --- | --- |
| 前端 | React 19、TanStack Router、Tailwind CSS v4 |
| 服务端 | TanStack Start、Server Functions |
| 数据库 | PostgreSQL、Drizzle ORM |
| 输入与类型 | Zod、TypeScript |
| 认证 | HTTP-only Cookie Session、bcrypt |
| 构建与运行 | Vite、Node.js 26、pnpm 10.33.4 |

## Done List

- 用户注册、登录、个人资料、密码修改与邮件找回。
- 群组创建与审核、成员申请与管理、帖子与多级回复。
- 公开和私密反馈、匿名保护、状态流转与处理记录。
- 帖子点赞与收藏、公告订阅、站内通知。
- 活动报名、取消、容量控制、签到与状态更新。
- 积分流水、活跃奖励、加权抽卡、成就进度与自动补发、商品兑换。
- 新生宿舍问卷、分配、调整与确认。
- 空间目录、时段查询、预约跟踪、取消、学号白名单与审核。
- 管理后台：反馈、群组、公告、活动、商城、成就、宿舍与用户统计。
- 统一侧栏、页面搜索、移动端导航、深浅主题、Markdown 与公式预览。
- 列表筛选与分页、当前范围计数、按时间倒序排列的回复。
- 版本发布与回滚、数据库管理、交互式管理员初始化。

## TODO List

- 系统化接入 TanStack Query。
- 补充登录、注册、抽卡和兑换的速率限制，完善宿舍状态机。
- 增加群内回复通知。
- 补充兑换、抽卡和宿舍流程的端到端测试。
- 继续调整详情页、移动端交互与可访问性。
- 将表结构变更逐步迁移到正式的 Drizzle migration 流程。

## Join COEER

欢迎通过 Issue 讨论问题或提出建议，也欢迎提交 Pull Request。参与开发前请阅读
[开发环境](docs/development.md)和[架构约定](docs/schema.md)；界面改动遵循 [DESIGN.md](DESIGN.md)。
