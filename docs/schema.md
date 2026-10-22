# 架构与开发约定

## 分层与目录

| 位置 | 职责 |
| --- | --- |
| `src/app/routes` | 文件式路由、loader、表单与页面状态 |
| `src/app/components/coeer` | 公共 UI、布局、卡片、弹窗与提示 |
| `src/server/functions` | Server Functions，输入校验与响应解包 |
| `src/server/services` | 鉴权、可见性、业务规则与事务编排 |
| `src/server/database/queries` | 原子查询 |
| `src/server/database/schemas` | Drizzle 表、枚举、约束与关系 |
| `src/server/open-space` | 预约引擎、适配器、后台任务与运维 |
| `src/shared` | 前后端共用的 Zod schema、类型与常量 |

调用方向为页面 → Server Functions → Service → Query → PostgreSQL。
前端不直接查库。路径别名为 `@/*` → `src/app/*`、`~/*` → `src/server/*`、
`@shared/*` → `src/shared/*`，定义在 `tsconfig.json` 与 `vite.config.ts`。
`routeTree.gen.ts` 由 Vite 路由插件生成，不手工修改。

## 路由与布局

`__root` 提供文档骨架、主题初始化和当前用户上下文。游客首页展示公开动态；
`/login`、`/signup`、`/forgot-password` 和 `/reset-password` 使用独立认证布局。
登录用户的首页和 `_authed/**` 共用 AppShell；未登录访问时跳转到
`/login?redirect=<原路径>`，回跳目标只接受内部地址。

`/admin/**` 的路由守卫检查平台管理员身份，服务端仍须再次鉴权。
群组详情通过 route context 提供群组和成员状态；群组列表按 URL 中的 `view` 切换范围。
空间预约使用主站 `/spaces` 与 `/admin/spaces` 文件路由和公共组件，不另建一套 UI。

## UI 约定

视觉规范见 [DESIGN.md](../DESIGN.md)，补充配置和组件预览见
[.impeccable/design.json](../.impeccable/design.json)。颜色从 `app.css` 的语义令牌读取，
新增样式使用 `text-foreground`、`bg-card`、`border-border` 等命名工具类。

桌面使用 224px 侧栏和 52px 路径栏，1024px 以下切换为抽屉。
内容最大宽度为 1440px，桌面左右留 32px，手机留 16px。
页面搜索支持 Cmd/Ctrl+K、方向键和 Enter，仅搜索已有页面名称与路径。
默认浅色；用户选择的深色主题保存在 `localStorage.coeer-theme`。

列表复用 `SectionHeader`、`FilterPanel`、行列表或卡片、`EmptyState` 和分页。
筛选标签不附带总数，总数放在底部分页；筛选与页码写入 URL，先筛选再分页。
表单复用 `Field`、`Input`、`Select`、`Textarea`；异步操作通过 `useAsyncAction`
管理提交状态，成功后再提示。保留键盘焦点、持久标签与减少动效设置。

## 响应与鉴权

Service 使用 `{ success, data, state: { code, message } }` 响应。
读取函数可返回完整响应；动作型函数解包失败并抛出业务消息，前端不能仅根据 Promise
完成就判断操作成功。新函数应沿用所属模块的方式。

Session 有效期为 7 天，Cookie 使用 `httpOnly`、`sameSite=lax`，生产使用 `secure`。
每次获取当前用户都按 ID 回查数据库，核对停用状态、角色和密码版本。
修改密码需要当前密码，成功后旧会话失效。普通注册只接受非保留的 10 位学生学号邮箱。
管理员由交互式 setup 创建，方法见 [deployment.md](deployment.md#创建唯一管理员)。

## 权限规则

| 业务 | 服务端约束 |
| --- | --- |
| 群组 | 创建后待平台审核；群内管理检查群管理员；成员变更始终保留至少一名管理员 |
| 群组可见性 | 私密或未审核内容按成员与角色检查；待审核申请仅管理人员可见 |
| 帖子 | 先检查群组可见性；发帖需已批准成员；公告与置顶需群管理员 |
| 回复 | 仅群内帖子开放；成员可读写、作者可编辑；作者或管理人员可删除；父回复须属于同帖 |
| 反馈 | 作者、平台管理员或公开范围可读；匿名作者对非管理员隐藏；状态流转仅管理员 |
| 点赞与收藏 | 先检查目标可见性；收藏归本人，分页前移除已无权访问的帖子 |
| 活动 | 报名检查时间与容量；名单和签到检查主办方或管理员；官方活动仅管理员可创建 |
| 兑换 | 扣分、减库存与订单同事务；订单及兑换码仅本人或管理员可读 |
| 抽卡 | 锁用户行、检查积分、按掉率加权抽取并入账；空奖池不扣分 |
| 宿舍与用户统计 | 管理操作检查平台管理员；宿舍状态与并发控制仍需继续完善 |
| 空间预约 | 主站登录、身份签名、学号白名单、CSRF、归属、容量与幂等检查 |

## 数据库与事务

社区表按用户、群组、反馈、互动、公告、活动、积分、卡片、成就、兑换与宿舍划分。
表名与字段以 `src/server/database/schemas/*.ts` 为准；积分余额为流水金额之和，
兑换订单保存 `quantity`，活动报名及用户收藏有唯一约束。

预约复用 `DATABASE_URL`，由 `postgres-schema.ts` 管理独立 `coeer_spaces` schema。
配置、初始化和运维见 [open-space.md](open-space.md)。旧 SQLite 文件不会自动导入。

需要原子性的主写、日志、通知、奖励和成就必须使用同一个事务连接。
抽卡与兑换按用户行锁串行扣款；库存使用带数量条件的递减。
群组成员变更锁群组行；预约使用事务锁串行处理容量和任务领取。
禁止在事务外执行本应属于事务的 Query。

## 新增功能

先在共享 contracts 定义输入与类型，再补表结构和 Query，在 Service 中实现鉴权、业务规则及事务，
通过 Server Function 接入页面。所有 ID、角色、主办方与目标归属都需要服务端验证。
新增表时同步审阅清空范围；新增成就代码时实现对应条件判定。

```sh
pnpm db:generate
pnpm typecheck
pnpm test
pnpm build
```

运行条件见 [development.md](development.md)与[检查命令](testing.md)，线上迁移见 [deployment.md](deployment.md)。
