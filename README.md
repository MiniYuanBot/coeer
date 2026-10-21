# COEER

学院/组织内部的**社区与成长激励系统**：群组与帖子、反馈闭环、公告订阅、活动报名、
积分 / 卡片 / 成就 / 兑换、新生宿舍分配，以及空间预约。

目前仍处于开发阶段（尚未正式部署，本地数据库为 PostgreSQL）。整体采用
**分层架构**（数据层 → 业务层 → 应用层 → 表现层）。路由与布局守卫最初借鉴
[dub](https://github.com/dubinc/dub) 的产品化组织方式；当前 UI 按用户指定的 Linear
产品界面重构，采用紧凑侧栏、路径栏、统一工具栏与反馈行列表，浅色默认并保留深色切换。

> 新朋友先读 **[docs/schema.md](docs/schema.md)**——它记录了路由模型、UI 设计
> 体系、权限/安全基线与事务并发约定，是维护和扩展的入口。部署参见
> [docs/deployment.md](docs/deployment.md)。

## Tech Stack

| 层级     | 技术                                                       |
| -------- | ---------------------------------------------------------- |
| Frontend | React 19, TanStack Router (SSR), TailwindCSS v4            |
| Backend  | TanStack Start `createServerFn`（服务端函数）              |
| Auth     | httpOnly Cookie + Session（会话每次回源校验角色/停用状态） |
| Database | PostgreSQL, Drizzle ORM                                    |
| Shared   | Zod（同一 schema 约束前后端类型与输入）                    |
| DevOps   | pnpm, TypeScript, Vite                                     |

TanStack Query、shadcn/ui、限流中间件仍属于预留能力；当前前端读取走路由
loader、写入走 Server Functions。

## Getting Started

空间预约已集成为“服务 → 空间预约”（`/spaces`），包含目录、时段选择、预约跟踪、取消、
白名单与审核管理；页面直接使用主站路由和公共组件，管理入口为 `/admin/spaces`。
运行环境统一为 **Node.js 26.x、npm 11.x、pnpm 10.33.4**（见 `package.json`）；
`.nvmrc` 与 `.node-version` 固定推荐版本 `26.7.0`。
默认本地 Mock 无需另启 OpenSpace；接入既有服务或官方 Connector，参见
[空间预约配置与使用](docs/open-space.md)。

### 项目检查

```sh
pnpm typecheck
pnpm test
pnpm build
# 或统一运行
pnpm check
```

统一测试覆盖社区账号、权限、内容可见性、活动报名、积分兑换、空间接入和发布脚本；
数据库测试使用内存 PostgreSQL 与临时 SQLite，不需要启动本机数据库。详见
[测试说明](docs/testing.md)。

### 安装与启动

1. **克隆**：

   ```sh
   git clone git@github.com:MiniYuanBot/coeer.git
   # 或 git clone https://github.com/MiniYuanBot/coeer.git
   ```

2. **安装依赖**（需要 pnpm；首次会自动构建 esbuild 等原生依赖）：

   ```sh
   pnpm install
   ```

3. **配置环境变量**：安装并启动 [PostgreSQL](https://www.postgresql.org/)，
   创建一个数据库，然后：

   ```sh
   cp .env.example .env
   # 按注释填写 DATABASE_URL、SESSION_SECRET（openssl rand -base64 48）
   ```

4. **推送表结构并运行**：

   ```sh
   pnpm db:push      # 上传数据库表结构（schema 变更后同样执行）
   pnpm dev          # 开发模式，默认 http://localhost:3000
   ```

   生产模式：

   ```sh
   pnpm check:env && pnpm build
   pnpm preview      # 或部署后用 pnpm start
   ```

5. **种子数据**（可分别注入，或 `pnpm seed:all` 一键注入；
   `pnpm seed:all:clean` 会清空后重建）：

   ```sh
   pnpm seed:users        # 测试用户 + 个人简介
   pnpm seed:community    # 群组（含私密群/待审核群）、成员申请、帖子
   pnpm seed:feedbacks    # 反馈 + 状态流转记录
   pnpm seed:gamification # 活动报名、卡片、成就、积分流水、兑换订单、互动
   ```

   演示数据覆盖各状态位：`book-club`（私密群，带 1 条待审核入群申请）、
   `campus-events`（待审核群，只有创建者可见）、匿名/公开/已解决/已驳回的反馈、
   已完成与待处理兑换订单（含 `quantity`），积分流水与订单金额自洽。
   > 积分是流水累计（余额 = Σ），需要从干净状态重跑时请使用 `seed:all:clean`。

   测试账号：

   | 角色      | 邮箱                | 密码       |
   | --------- | ------------------- | ---------- |
   | student   | `test@example.com`  | `test1234` |
   | moderator | `demo@example.com`  | `demo1234` |
   | admin     | `admin@example.com` | `admin123` |

   > 种子账号仅用于开发/演示，禁止指向生产库；`--clean` 会删除业务表数据。

## Project Architecture

三个顶层目录，别名见 `tsconfig.json`/`vite.config.ts`：

```
src/
├─ shared/    前后端共享：常量(constants)、Zod 校验与类型(contracts)
├─ server/    后端
│  ├─ database/  表结构 schemas / 连接池 client / 原子查询 queries
│  ├─ services/  业务服务（唯一做鉴权与业务规则）
│  ├─ functions/ Server Functions（前端唯一入口，做输入校验与解包）
│  └─ utils/     session、密码、目标可见性(access)、seo
└─ app/       前端
   ├─ routes/      文件式路由（公共区 + `_authed` 产品外壳 + `/admin`）
   ├─ components/  coeer UI 体系 / basic 兜底页 / ui(AuthForm)
   ├─ hooks/       客户端 hooks
   └─ styles/      设计令牌（语义化 CSS 变量 + @theme 工具类映射）
```

### 路由与外壳

- **公共区**：`/login`、`/signup`、`/logout`；游客首页使用品牌、主题切换和
  登录/注册页头，左对齐介绍与公开动态预览；认证页为居中窄表单，不套工作区外壳；
- **登录区**：`_authed/**` 统一渲染侧边栏外壳（品牌 + 分组导航 + 主题/用户区），
  已登录访问 `/` 也进入同一外壳（侧边栏“动态”不再跳出框架）；
  未登录访问自动 `redirect` 到 `/login?redirect=<原路径>`，登录后回跳；
- **平台管理**：`/admin/**`（仅 `admin` 角色，布局层守卫 + 服务端再校验）；
- 列表页复用 `SectionHeader` → `FilterPanel`（筛选写入 URL）→ 行列表、卡片网格或
  表格 → `EmptyState` → 分页；反馈使用对齐行列表，首页信息流使用分隔线；
  详情/表单页复用 `Card + Modal + Toast`；
- 桌面外壳为 232px 侧栏与 52px 路径栏，移动端切换为抽屉；页面搜索支持
  Cmd/Ctrl+K、方向键和 Enter 跳转。

视觉令牌与组件规则以 [DESIGN.md](DESIGN.md) 为准，机器可读扩展与组件预览位于
[.impeccable/design.json](.impeccable/design.json)；实现模型见 [docs/schema.md §3](docs/schema.md)。

### 数据与安全

- 统一响应 `{ success, data, state:{code,message} }`；动作型 Server Function
  失败会抛 `state.message`（前端不弹假成功）；
- Session cookie httpOnly/secure/sameSite=lax；**`getCurrentUser` 每次回源校验**
  （停用账号、已删除用户、角色变更即时生效）；
- 服务端 Service 是唯一安全边界：群组/帖子/反馈/活动/商城/卡片各自有角色与归属
  规则；兑换与抽卡在**单事务 + 用户行锁**内完成（防双花/超卖/假掉率）；
- 主要漏洞清单与修复说明、以及已知待办见 [docs/schema.md §5](docs/schema.md)。

## Project Status

### Done List

1. 用户与认证体系（会话回源校验、停用检查、内部跳转白名单）
2. 群组系统（创建/申请/成员管理/群组审核，修复自我审批与成员泄露）
3. 群组帖子系统（公告置顶、作者/群管理权限、私密群内容可见性）
4. 反馈系统（匿名保护、状态流转与日志同事务、管理员统计）
5. 互动系统（点赞、回复；目标可见性校验）
6. 公告栏与订阅系统
7. 活动系统（报名容量、主办方签到/名单、official 活动仅平台 admin）
8. 积分、卡片、成就与兑换系统（抽卡按掉率加权、兑换/抽卡事务化、订单仅本人或
   admin 可见）
9. 新生宿舍分配（问卷 → 管理员按届计算/调整/确认下发）
10. 路由与 UI 重构：保留路径组守卫与 `/login?redirect=` 回跳；当前采用 Linear
    参考的侧栏/路径栏外壳、移动抽屉、键盘页面导航、反馈行列表、浅色默认与深色
    切换，以及统一语义令牌、空状态、弹窗和中文 404/错误页
11. 管理后台：反馈审核、群组审核、公告/活动/商城/成就管理、宿舍管理、用户统计
12. 依赖收敛：移除未使用的 jsonwebtoken/JWT_SECRET 等

### TODO List

1. 页面数据加载系统化接入 TanStack Query
2. 速率限制（登录/注册/抽卡/兑换）与宿舍状态机加固
3. 评论/通知等新交互模块
4. 关键流程（兑换、抽卡、宿舍）的端到端测试
5. 继续打磨详情页、移动端细节与可访问性
6. `db:push` 长期建议切换为正式 Drizzle migration

## Test Commands

```sh
pnpm install
pnpm check:env
pnpm db:push -- --force
pnpm exec tsc --noEmit
pnpm build
```

分模块种子 / 清理：

```sh
pnpm seed:users && pnpm seed:community && pnpm seed:feedbacks && pnpm seed:gamification
pnpm seed:all:clean
```

## Deployment

已部署的阿里云服务器支持在本机执行 `npm run deploy` 一键发布当前代码；
`npm run deploy:check` 只读预检，`npm run deploy:rollback` 回滚上一版本。
脚本会在独立目录构建并检查新版本，通过后才切换服务；失败自动恢复，不自动改数据库。
目标配置见 `deploy/aliyun.json`，详细流程与首次搭建说明见下方部署文档。

部署参考 [docs/deployment.md](docs/deployment.md)（systemd + Nginx + HTTPS），
示例文件在 `deploy/systemd/coeer.service` 与 `deploy/nginx/coeer.conf`。

## Join COEER

欢迎贡献：Fork 本仓库 → clone 到本地 → 新建功能分支（如 `feature/xxx`）→
修改并自测（至少 `pnpm exec tsc --noEmit` 与 `pnpm build` 通过）→ 提交 Pull Request，
说明改动即可。
