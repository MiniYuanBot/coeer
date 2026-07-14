# COEER

目前还处在开发阶段，尚未部署，数据库仍使用本地 PostgreSQL。项目整体采用分层架构设计，自底向上分为数据层、业务层、应用层和表现层。

## Tech Stack

首先介绍一下我计划中的技术栈框架。

| 层级 | 技术 |
| ---- | ---- |
| Frontend | React, TanStack Router, TailwindCSS |
| Backend | TanStack Start `createServerFn` |
| Auth | HTTP-only Cookies, Session Management |
| Database | PostgreSQL, Drizzle ORM |
| Security | RLS, CSRF protection, Rate Limiting（预留） |
| DevOps | pnpm, TypeScript, ESLint, Vite |

TanStack Query、shadcn/ui、JWT、RLS 和更完整的安全中间件仍属于预留或后续接入能力。当前前端调用后端的主入口是 `src/server/functions` 中的 TanStack Start Server Functions。

## Getting Started

1. 将项目 clone 到本地

使用 ssh:

```sh
ssh -T git@github.com
git clone git@github.com:MiniYuanBot/coeer.git
```

或直接 clone（可能不稳定）:

```sh
git clone https://github.com/MiniYuanBot/coeer.git
```

1. 安装核心依赖

在项目根目录运行:

```sh
pnpm install
```

1. 配置环境变量

首先安装 [PostgreSQL](https://www.postgresql.org/)，注意记住安装时输入的密码，并且最后勾选安装 pgAdmin4，后续就可以使用图形化界面了。
安装完成后，启动 pgAdmin4，在左侧找到 Databases，右键点击后选择 Create，创建数据库。在项目根目录建立文件 `.env` 并按照 `.env.example` 文件中所示格式填写数据库连接字符串，注意替换成你的密码和你的数据库名。

1. 运行

首先上传数据库表结构

```sh
pnpm db:push
```

然后直接运行 development 应该就可以了

```sh
pnpm dev
```

也可以使用 production 模式输出到 `./dist`，再进行预览

```sh
pnpm build
pnpm preview
```

项目中也有一些数据库种子，详见 `package.json`。为了快速测试，可以使用：

```sh
# 注入测试用户
pnpm seed:users

# 注入群组、成员、帖子
pnpm seed:community

# 注入反馈
pnpm seed:feedbacks

# 注入活动、公告、卡片、成就、积分商城等
pnpm seed:gamification

# 或者直接统一注入
pnpm seed:all
```

测试用户账号：

| 角色 | 邮箱 | 密码 |
| ---- | ---- | ---- |
| student | `test@example.com` | `test1234` |
| admin | `admin@example.com` | `admin123` |
| moderator | `demo@example.com` | `demo1234` |

如果希望重置测试数据后重新注入，可以使用：

```sh
pnpm seed:all:clean
```

## Deployment

COEER 是 TanStack Start SSR 应用，并依赖 PostgreSQL 与 Server Functions，因此不能只作为静态站点部署。推荐部署到自己的 Linux 服务器，使用 Nginx 反向代理到本地 Node.js 服务。

部署前先准备生产环境变量：

```sh
cp .env.example .env
```

至少需要设置：

- `NODE_ENV=production`
- `PORT=3000`
- `CLIENT_URL=https://your-domain.com`
- `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME`
- `JWT_SECRET`：至少 32 位
- `SESSION_SECRET`：至少 32 位

生产构建与启动：

```sh
pnpm install --frozen-lockfile
pnpm check:env
pnpm db:push
pnpm build
pnpm start
```

服务器部署可参考 [docs/deployment.md](docs/deployment.md)，其中包含 PostgreSQL、systemd、Nginx 和 HTTPS 配置示例。示例文件位于：

- `deploy/systemd/coeer.service`
- `deploy/nginx/coeer.conf`

## Project Architecture

整体上讲，`app` 文件夹负责前端，`server` 文件夹负责后端，`shared` 文件夹负责共享类型定义。我为三个文件夹都定义了别名，根目录是`src`，具体见 `tsconfig.json` 和 `vite.config.ts`

### Environment Variables

环境变量配置方面，所有前端会用到的环境变量（以`VITE_` 开头）在 `src/vite-env.d.ts` 中。后端可以使用前端环境变量以及 server-only 的环境变量，定义在 `src/server/config` 中

### Shared Files

在 `shared` 文件夹下主要放置项目常量、Zod 输入校验、前后端共享类型和统一响应结构。这一部分的根目录是 `shared`

- 项目常量：`./constants`
- Zod 类型检查与输入输出类型：`./contracts`
- 统一响应结构：`./contracts/shared.ts`

### Data Access Layer

数据层的主要任务是注入数据库表结构、连接 Drizzle ORM 数据库，以及进行原子查询操作。这一层的根目录是 `server/database`

- 数据库表结构与 relations：`./schemas`
- 连接 Drizzle ORM 数据库：`./client`
- 原子查询操作：`./queries`

### Business Layer

业务层的主要任务是为前端提供完整的后端服务。也即前端不应直接进行数据库查询操作，所有查询操作都应在业务层完成，前端只能调用业务层。这一层的根目录是 `server/services`

已按领域拆分为 `AuthService`、`GroupService`、`GroupPostService`、`FeedbackService`、`ReactionService`、`ReplyService`、`BulletinService`、`SubscriptionService`、`ActivityService`、`PointService`、`CardService`、`AchievementService`、`RedeemService` 等。

### Application Layer

应用层的主要任务是完成路由逻辑、定义服务器函数

- 完成路由逻辑：`app/routes`
- 定义 Server Functions：`server/functions`

Server Function 只负责输入校验、调用 Service 和少量框架级跳转。业务失败默认以 `{ success, state, data }` 形式返回，不在这一层统一抛异常。

### Presentation Layer

表现层的主要任务是完成 UI 界面设计，并逐步接入 TanStack Query 管理客户端状态。当前已经实现一套 React + TailwindCSS 的 COEER 前端界面：整体为 sticky 顶部导航、居中内容容器、浅色/暗色模式、轻卡片、细边框和蓝紫强调色，定位为校园社区平台 + 管理工作台 + 轻游戏化成长系统。

- UI 界面设计：`app/components`
- 页面路由：`app/routes`
- 客户端 hooks：`app/hooks`
- TanStack Query：依赖已安装，尚未系统化接入

核心 UI 组件集中在 `src/app/components/coeer`，包含 `AppShell`、`TopNav`、`MobileNav`、`Card`、`Button`、`Badge`、`SearchInput`、`PostCard`、`GroupCard`、`BulletinCard`、`ActivityCard`、`FeedbackCard`、`PointsSummaryCard`、`AchievementCard`、`RedeemItemCard`、`CommentList`、`EmptyState`、`Toast`、`Modal` 和 `Drawer`。

主要页面入口：

- `/login`、`/signup`：认证页
- `/`：动态首页
- `/groups`：群组列表，详情沿用 `/groups/$slug`
- `/feedbacks`、`/feedbacks/create`：反馈列表与提交
- `/bulletins`、`/bulletins/$bulletinId`：公告列表与详情
- `/activities`、`/activities/$activityId`：活动列表与详情
- `/redeems`：积分商城
- `/achievements`：卡片/成就墙
- `/profile`：个人中心

## Project Status

上述只是一些粗糙的介绍，不甚准确。下面列举项目目前的情况。

### Feature List

我目前想要实现的功能：

1. 用户与认证体系
2. 群组系统
3. 群组帖子系统
4. 反馈系统
5. 互动系统
6. 公告栏系统
7. 活动系统
8. 积分与激励系统

### Done List

整体上，数据层、业务层、应用层已经为主要功能系统补齐后端业务底座。目前初步完成的功能：

1. 用户与认证体系
2. 群组系统
3. 群组帖子系统
4. 反馈系统
5. 互动系统（点赞、回复）
6. 公告栏与订阅系统
7. 活动系统
8. 积分、卡片、成就与兑换系统的后端基础能力
9. COEER 前端 UI 基础体验与主要页面骨架

### TODO List

目前的任务：

1. 将页面数据加载进一步系统化接入 TanStack Query hooks
2. 将抽卡概率、积分扣减、兑换库存等关键流程进一步收紧为数据库事务
3. 根据前端实际体验继续修正 Service 权限与返回数据形状
4. 为新模块继续补充端到端测试
5. 继续打磨管理端、详情页和移动端细节

## Test Commands

完整本地验证流程：

```sh
pnpm install
pnpm check:env
pnpm db:push -- --force
pnpm seed:all:clean
pnpm exec tsc --noEmit
pnpm build
```

如果希望手动确认 Drizzle 生成的 SQL，可以把 `pnpm db:push -- --force` 换成 `pnpm db:push`。

分模块种子命令：

```sh
pnpm seed:users
pnpm seed:community
pnpm seed:feedbacks
pnpm seed:gamification
```

分模块清理并重建：

```sh
pnpm seed:users:clean
pnpm seed:community:clean
pnpm seed:feedbacks:clean
pnpm seed:gamification:clean
```

## Join COEER

如果你想要加入我们，请你先在 GitHub 上点击该项目的 Fork 按钮将其复制到你的账号下，再运行

```bash
git clone https://github.com/your_name/coeer.git
# 或者 ssh
git clone git@github.com:your_name/coeer.git
```

将项目克隆至本地。建议你创建一个功能分支

```bash
git checkout -b feature/your_feature
```

然后在该分支上进行修改。完成后，可以在你的 GitHub 仓库上点击 Pull Request 按钮提交 PR，选择将分支合并到原项目的主分支并填写有关说明，经过我的审核后即可合并到主分支啦！
