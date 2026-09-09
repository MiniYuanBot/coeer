# COEER

学院/组织内部的**社区与成长激励系统**：群组与帖子、反馈闭环、公告订阅、活动报名、
积分 / 卡片 / 成就 / 兑换，以及新生宿舍分配。

目前仍处于开发阶段（尚未正式部署，本地数据库为 PostgreSQL）。整体采用
**分层架构**（数据层 → 业务层 → 应用层 → 表现层），前端路由与 UI 借鉴
[dub](https://github.com/dubinc/dub) 的产品化组织方式：路径组划分公共区与登录区、
守卫集中在布局层、侧边栏式产品外壳与统一的页面骨架。

> 新朋友先读 **[docs/schema.md](docs/schema.md)**——它记录了路由模型、UI 设计
> 体系、权限/安全基线与事务并发约定，是维护和扩展的入口。部署参见
> [docs/deployment.md](docs/deployment.md)。

## Tech Stack

| 层级 | 技术 |
| ---- | ---- |
| Frontend | React 19, TanStack Router (SSR), TailwindCSS v4 |
| Backend | TanStack Start `createServerFn`（服务端函数） |
| Auth | httpOnly Cookie + Session（会话每次回源校验角色/停用状态） |
| Database | PostgreSQL, Drizzle ORM |
| Shared | Zod（同一 schema 约束前后端类型与输入） |
| DevOps | pnpm, TypeScript, Vite |

TanStack Query、shadcn/ui、限流中间件仍属于预留能力；当前前端读取走路由
loader、写入走 Server Functions。

## Getting Started

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

   | 角色 | 邮箱 | 密码 |
   | ---- | ---- | ---- |
   | student | `test@example.com` | `test1234` |
   | moderator | `demo@example.com` | `demo1234` |
   | admin | `admin@example.com` | `admin123` |

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

### 路由与外壳（dub 风格）

- **公共区**：`/login`、`/signup`、`/logout`；游客访问 `/` 显示品牌落地页
  （无导航顶栏，仅品牌 + 登录/注册 + 公开动态预览，与登录页视觉一致）；
- **登录区**：`_authed/**` 统一渲染侧边栏外壳（品牌 + 分组导航 + 主题/用户区），
  已登录访问 `/` 也进入同一外壳（侧边栏“动态”不再跳出框架）；
  未登录访问自动 `redirect` 到 `/login?redirect=<原路径>`，登录后回跳；
- **平台管理**：`/admin/**`（仅 `admin` 角色，布局层守卫 + 服务端再校验）；
- 列表页统一骨架：`SectionHeader` → `FilterPanel`（筛选写入 URL）→ 卡片网格 →
  `EmptyState` → 分页；详情/表单页复用 `Card + Modal + Toast`。

UI 令牌（亮/暗、主色、语义色）、组件与布局细节见 [docs/schema.md §3](docs/schema.md)。

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
10. dub 风格路由与 UI 重构：侧边栏产品外壳 + 移动端抽屉、路径组守卫与
    `/login?redirect=` 回跳、语义化设计令牌、统一列表/空状态/弹窗体系、中文
    404/错误页
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

部署参考 [docs/deployment.md](docs/deployment.md)（systemd + Nginx + HTTPS），
示例文件在 `deploy/systemd/coeer.service` 与 `deploy/nginx/coeer.conf`。

## Join COEER

欢迎贡献：Fork 本仓库 → clone 到本地 → 新建功能分支（如 `feature/xxx`）→
修改并自测（至少 `pnpm exec tsc --noEmit` 与 `pnpm build` 通过）→ 提交 Pull Request，
说明改动即可。
