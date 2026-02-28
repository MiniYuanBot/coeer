# COEER

目前还出在开发阶段，尚未部署。整体上使用分层架构设计，自底向上分为数据层、业务层、应用层和表现层。

## Tech Stack

首先介绍一下我计划中的技术栈框架。

| 层级 | 技术 |
|------|------|
| Frontend | React, TanStack Router, TanStack Query, TailwindCSS, shadcn/ui |
| Backend | Nitro (TanStack Start API Routes) |
| Auth | JWT, HTTP-only Cookies, Session Management, RLS |
| Database | PostgreSQL, Drizzle ORM |
| Security | RLS, CSRF protection, Rate Limiting |
| DevOps | pnpm, TypeScript, ESLint, Vite |

其中 Auth 中的 JWT 和 RLS 尚未使用。Security 尚未使用。TanStack Query 尚未使用。shadcn 尚未使用。

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

2. 安装核心依赖

在项目根目录运行:

```sh
pnpm install
```

3. 配置环境变量

首先安装 [PostgreSQL](https://www.postgresql.org/)，注意记住安装时输入的密码，并且最后勾选安装 pgAdmin4，后续就可以使用图形化界面了。
<br />
安装完成后，启动 pgAdmin4，在左侧找到 Databases，右键点击后选择 Create，创建数据库。在项目根目录建立文件 `.env` 并按照 `.env.example` 文件中所示格式填写数据库连接字符串，注意替换成你的密码和你的数据库名。另外 `JWT_SECRET` 还未使用。

4. 运行

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
pnpm dev
pnpm preview
```

项目中也有一些数据库种子，但是数据库结构有变，种子还未修改，可能有错。详见 `package.json`

## Project Architecture

整体上讲，`app` 文件夹负责前端，`server` 文件夹负责后端，`shared` 文件夹负责共享类型定义。我为三个文件夹都定义了别名，根目录是`src`，具体见 `tsconfig.json` 和 `vite.config.ts`

### Environment Variables

环境变量配置方面，所有前端会用到的环境变量（以`VITE_` 开头）在 `src/vite-env.d.ts` 中。后端可以使用前端环境变量以及 server-only 的环境变量，定义在 `src/server/config` 中

### Data Access Layer

数据层的主要任务是注入数据库表结构、连接 Drizzle ORM 数据库，以及进行原子查询操作。这一层的根目录是 `server/database`

- 数据库表结构：`./schemas`
- 连接 Drizzle ORM 数据库：`./client`
- 原子查询操作：`./queries`

### Business Layer

业务层的主要任务是为前端提供完整的后端服务。也即前端不应直接进行数据库查询操作，所有查询操作都应在业务层完成，前端只能调用业务层。这一层的根目录是 `server/services`

- 认证有关：`./AuthService`
- 反馈有关：`./FeedbackService`
- 群组有关：`./GroupService`

以此类推。

### Application Layer

应用层的主要任务是完成路由逻辑、定义服务器函数

- 完成路由逻辑：`app/routes`
- 定义服务器函数：`server/functions`

### Presentation Layer

表现层的主要任务是完成 UI 界面设计、使用 tanstack Query 管理状态

- UI 界面设计：`app/components`
- 使用 tanstack Query 管理状态：暂未实现

## Project Status

上述只是一些粗糙的介绍，不甚准确。下面列举项目目前的情况。

## Feature List

我目前想要实现的功能：
1. 用户与认证体系
2. 群组系统
3. 群组帖子系统
4. 反馈系统
5. 互动系统
6. 公告栏系统
7. 活动系统
8. 积分与激励系统

## Done List

整体上，我对于数据层、业务层、应用层中，我提及的功能系统都有了较为清晰的规划。目前初步完成的功能：
1. 用户与认证体系
2. 群组系统
3. 群组帖子系统
4. 反馈系统

## TODO List

目前的任务：
1. 表现层构建约等于 0，或者说我目前对于表现层还没有任何规划
2. 加快建设剩余功能系统
3. 依据前端设计对后端进行修改与修正