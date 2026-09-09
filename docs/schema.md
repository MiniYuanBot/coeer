# COEER 框架说明（schema）

> COEER 是学院/组织内部社区与成长激励系统：群组与帖子、反馈闭环、公告、
> 活动报名、积分/卡片/成就/兑换，以及新生宿舍分配。
>
> 本文描述项目当前的**约定与实现模型**（routes / components / server / shared /
> DB schema / 权限与安全模型），是维护与扩展的入口文档。阅读顺序建议：
> 架构分层 → 路由模型 → UI 体系 → 数据与权限 → 安全基线。

---

## 1. 技术栈与分层

| 层级 | 技术 | 位置 |
| ---- | ---- | ---- |
| 表现层 | React 19 + TanStack Router(SSR) + Tailwind v4 | `src/app` |
| 应用层 | TanStack Start `createServerFn`（服务端函数） | `src/server/functions` |
| 业务层 | 领域 Service 类（鉴权/校验/编排） | `src/server/services` |
| 数据层 | Drizzle ORM 查询封装（原子操作） | `src/server/database/queries` |
| 共享层 | Zod 校验、类型、常量（前后端共用） | `src/shared` |
| 认证 | httpOnly Cookie Session（h3 seal，7 天） | `src/server/utils/session.ts` |

依赖方向自上而下，**前端永远不直接查库**：`app/routes` → `~/functions`（server
functions）→ `services` → `queries` → DB；输入在 `shared/contracts` 用 Zod 定义，
同一份 schema 同时约束客户端调用与 TS 类型。

路径别名：`@/*` = `src/app/*`，`~/*` = `src/server/*`，`@shared/*` = `src/shared/*`
（见 `tsconfig.json` 与 `vite.config.ts`）。

### 1.1 目录导览

```
src/
├─ app/                        # 前端（表现层）
│  ├─ router.tsx               # createRouter + NotFound/Error 全局兜底
│  ├─ routeTree.gen.ts         # 自动生成，勿手改（vite dev/build 时重新生成）
│  ├─ routes/                  # 文件式路由（见 §2）
│  ├─ components/
│  │  ├─ coeer/                # 产品级 UI 体系
│  │  │  ├─ ui/                #   Button / Card / Badge / Input / FilterPanel …
│  │  │  ├─ layout/            #   AppShell / Sidebar / PublicNav / ThemeToggle …
│  │  │  ├─ cards/             #   PostCard / GroupCard / ActivityCard …
│  │  │  ├─ feedback/          #   Modal / Toast
│  │  │  └─ hooks/lib/         #   useAsyncAction / cn / date / labels / redirect
│  │  ├─ basic/                #   NotFound / DefaultCatchBoundary
│  │  └─ ui/AuthForm.tsx       #   认证表单（登录/注册共用）
│  ├─ hooks/                   # 客户端 hooks（useAuthMutations, useMutation）
│  └─ styles/app.css           # 设计令牌（§3.1）
├─ server/
│  ├─ config/env.ts            # 服务端环境变量（Zod 校验，缺失即退出）
│  ├─ database/                # schemas(表) + client(连接池) + queries(原子操作)
│  ├─ services/                # 业务服务（唯一做鉴权/业务规则的地方）
│  ├─ functions/               # createServerFn 服务端函数（前端唯一入口）
│  └─ utils/                   # session / password / access(可见性) / seo
└─ shared/
   ├─ contracts/               # Zod schema + 派生类型 + 统一响应结构
   └─ constants/               # 领域枚举/状态码/中文文案
```

---

## 2. 路由模型（TanStack Router 文件式路由）

### 2.1 整体结构

```
routes/
├─ __root.tsx                    # html/head(字体、主题预置脚本)/body + Toast + 路由条
│                                #   beforeLoad 拉取 session 用户 → context.user
├─ index.tsx                     # 公共首页（'/'），PublicNav 顶栏 + 动态信息流
├─ login.tsx / signup.tsx        # 认证页：独立版式；已登录访问自动跳 '/'
│                                #   validateSearch.redirect（内部路径白名单）
├─ logout.tsx                    # loader-only：清 session → 回 '/'
└─ _authed/                      # 登录态 pathless 组（真正的 App Shell）
   ├─ route.tsx                  # 守卫 + <AppShell>（Sidebar 侧边栏 + 内容区）
   ├─ profile/ achievements/ activities/ bulletins/ feedbacks/ redeems/ dorms/
   ├─ groups/  (/create /$slug/*；列表用 /groups?view=joined|managed|public|pending)
   └─ admin/                     # 平台管理（route 层二次守卫 role==='admin'）
```

**公共区与登录区的划分方式（参考 dub 的做法）**：根路由只负责文档骨架与全局
上下文；是否进入“产品外壳”由路径组决定——

- `/login`、`/signup` 属于公共认证区（居中卡片式，无顶栏），游客访问 `/` 时
  显示品牌落地页（无导航链接，仅品牌 + 登录/注册 + 公开动态预览）；
- 登录用户访问 `/` 时渲染在 **AppShell 侧边栏外壳**内（与其它内容页完全一致）；
- `_authed/**` 全部渲染在侧边栏外壳中；`/admin/**` 在 `_authed` 外壳内再叠加
  平台管理员守卫。
- 冗余路由 `/groups/all`、`/groups/my` 已删除：统一收敛到 `/groups?view=…` 标签页。

### 2.2 鉴权与守卫（谁在拦）

| 位置 | 规则 | 实现 |
| ---- | ---- | ---- |
| `__root.beforeLoad` | 无 session → `context.user = null` | `fetchUserFn`（不抛错，公共页可浏览） |
| `_authed/route.tsx` | 无 `context.user` → 重定向 `/login?redirect=<原路径>` | `throw redirect` |
| `_authed/admin/route.tsx` | `role !== 'admin'` → 重定向 `/` | `throw redirect` |
| `groups/$slug/*` | `beforeLoad` 取群组；`context.isAdmin/isMember` 供子页使用 | route context |
| `groups/$slug/settings`、`admin` | 非群管理员 → 重定向回群组主页 | `context.isAdmin` 守卫 |
| 服务端 | 所有写操作与敏感读操作再次校验 session 用户/角色/归属 | `services`（见 §4.3） |

> 规则：**前端守卫只负责 UX，服务端 Service 才是真正的安全边界。**
> 早期版本用 `throw new Error('Not authenticated')` + errorComponent 在页面内
> 渲染登录框的做法已废弃；现在一律先 `redirect` 到 `/login`（带 `redirect`
> 参数，登录成功后回跳）。`/login`/`/signup` 仅接受内部相对路径作为跳转目标
> （`lib/redirect.ts` 的 `safeRedirect`），防止开放重定向。

### 2.3 布局模式（layout route + index）

- 每个域目录（如 `feedbacks/`）内：`route.tsx` = 布局/守卫（通常 `Outlet`），
  `index.tsx` = 列表页，`create.tsx`、`$id/*` 等 = 子页；
- 列表页统一骨架：`SectionHeader`（标题/描述/操作）→ `FilterPanel`
  （搜索 + 过滤组，状态写入 URL search params）→ 卡片网格/表格 →
  `EmptyState` → `Pagination`（上一页/下一页）。
- 分页、搜索条件都存在 **URL**（`validateSearch` + `loaderDeps`），刷新/分享
  可还原，返回键回到同一状态。

---

## 3. UI 设计体系（dub-inspired）

### 3.1 设计令牌（`styles/app.css`）

一套语义化 HSL 令牌同时驱动“旧式任意值类”与“新式命名工具类”：

| 令牌 | 用途 | 亮色 ≈ | 暗色 ≈ |
| ---- | ---- | ----- | ----- |
| `--background / --foreground` | 画布 / 正文 | 白纸 / 近黑 | 近黑 / 浅灰 |
| `--card / --border` | 表面 / 发丝边框 | 白 / gray-200 | gray-900 / gray-800 |
| `--muted / --muted-foreground` | 次级表面 / 弱文本 | gray-100 / gray-500 | gray-800 / gray-500 |
| `--primary / --primary-soft` | 强调色（蓝）/ 强调浅底 | blue-600 | blue-400 |
| `--ring` | 焦点环 | blue-600 | blue-400 |
| `--danger / --success / --warning` | 语义状态 | — | — |

`@theme inline` 把令牌映射为 `text-foreground`、`bg-card`、`border-border`、
`bg-primary-soft`、`text-muted-foreground` 等工具类，新代码一律用命名类；
`.coeer-card`/`.coeer-container`/`.coeer-focus`/`.coeer-scrollbar`/`.coeer-kbd`
为跨页公共组件类。字体：Inter（Google Fonts link）+ 中文系统字体回退；
暗色由 `<html class="dark">` 驱动，`__root` head 内置防闪烁脚本
（先读 `localStorage.coeer-theme` 再回退系统偏好）。

### 3.2 外壳（layout 体系）

```
Desktop (lg+)                        Mobile (< lg)
┌──────────┬──────────────────┐      ┌───────────────────┐
│ Sidebar  │  主内容           │      │ 顶栏(品牌+头像+☰) │
│ (w-64)   │  coeer-container  │      ├───────────────────┤
│ 品牌      │  页面自身内容      │      │ ☰ → 左侧抽屉(同款  │
│ 分组导航  │                  │      │     Sidebar)      │
│ 主题/用户 │                  │      └───────────────────┘
└──────────┴──────────────────┘
```

- `AppShell`（`layout/AppShell.tsx`）：桌面固定左侧栏 + 主内容；移动端顶部条 +
  左侧抽屉（打开时锁定 body 滚动、点击遮罩/选中菜单自动关闭）。
- `Sidebar`（`layout/Sidebar.tsx`）：品牌块、按“社区 / 服务 / 成长”分组的导航
  （`layout/navItems.ts` 数据驱动，`NavLink` 带 `active` 策略：`/` 精确匹配，
  其余前缀匹配），平台管理员额外“管理”分组；底部为主题切换 + 用户卡片
  （个人中心 / 退出）。
- 游客首页是“品牌落地页”（无导航顶栏，仅品牌 + 登录/注册 + 动态预览），
  视觉与登录页一致；登录后同一路径进入 AppShell。
- 认证页（`/login`、`/signup`）独立版式（左右分栏品牌卡 + 居中表单），
  不套外壳；页面右上角提供主题切换。

### 3.3 基础组件（`components/coeer/ui`）

| 组件 | 约定 |
| ---- | ---- |
| `Button` | variants: primary/secondary/outline/ghost/danger；sizes sm/md/lg/icon；`loading` |
| `Badge` | tones: default/primary/success/warning/danger |
| `Card` | 平卡 + 发丝边框，无投影/上浮（dub 风格） |
| `SectionHeader` | 每页标题区：标题 + 描述 + 右侧操作区 |
| `FilterPanel` | 搜索框 + 过滤组（**分组标题会渲染**）；选中态高亮 |
| `SearchInput` | 图标前置输入框 |
| `EmptyState` | 空状态插图区 + 标题/描述/CTA |
| `Modal` | 居中弹窗（aria-modal、Esc 关闭、关闭按钮有 label） |
| `Toast` | Provider + `useToast()`，tone 标签正确、id 自增防碰撞 |

列表页与分页是反复出现的模式——新增页面时优先复用这些组件，而不是复制骨架。

---

## 4. 数据与权限模型

### 4.1 统一响应结构（`shared/contracts/shared.ts`）

```ts
type ActionResponse<T, S> = { success: boolean; data?: T; state: { code: S; message?: string } }
type PaginatedActionResponse<T, S> = ActionResponse<{ items?: T[]; total?: number; limit?: number; offset?: number }, S>
```

约定：**业务失败绝不靠抛字符串异常传话**。读取类函数按域不同有两种收口方式，
两种都有 `success` 语义，页面按需消费：

1. **直通 envelope**（登录/注册/积分/卡片/商城/活动列表等）：前端读
   `res.success` / `res.data`；
2. **解包并抛错**（群组/反馈/帖子/宿舍，以及注册报名、抽卡、兑换等“动作型”函数）：
   `if (!result.success) throw new Error(result.state.message)`——配合
   `useAsyncAction` 只会对真正的成功弹成功 toast。

> 早期“envelope 直通 + 前端误当成功”的缺陷（库存不足/积分不足却提示成功）
> 已修复；新函数请二选一并注明，不要混用。

### 4.2 会话与用户（7 天 Cookie，但每次回源校验）

- 登录/注册成功 → `session.update(user)`，cookie `httpOnly + secure(prod) +
  sameSite=lax`，有效期 7 天（`server/utils/session.ts`）。
- **`AuthService.getCurrentUser()` 每次都会用 `users.id` 回查数据库**：
  - 用户被停用（`isActive=false`）或已删除 → 立即清 session 并返回未授权；
  - role/name 以 DB 为准 → 角色降级、改名立即生效，不再受 7 天 cookie 影响。
- 登录时检查 `isActive`，停用账号无法登录。

### 4.3 权限核查清单（Server Service = 安全边界）

| 域 | 写操作规则 |
| --- | --- |
| 群组 | 创建=任何人（pending）；**平台审核**仅 `role==='admin'`（`approveGroup`/`updateGroupStatus`）；普通更新/删除/成员管理=群组 admin（非最后一个 admin） |
| 群组帖子 | 发帖=已通过审核群组的已批准成员；公告/置顶=群组 admin；编辑/删除=作者或群组 admin；**读**（getById/listByGroup）先做群组可见性校验 |
| 群组可见性 | 未审核群组对非成员不可见（slug 直接访问也返回未找到）；成员列表：非公开群组仅成员可见，pending 申请仅群组 admin 可见；`memberCount` 只统计已批准 |
| 反馈 | 查看：公开(isPublic)/作者/admin；**匿名反馈对非管理员隐藏作者**；状态流转仅 admin（与日志同事务） |
| 回复/点赞 | 只能作用于“自己可见”的目标（post 的群组可见性 / feedback 的公开或归属），否则 TARGET_NOT_FOUND |
| 活动 | 报名=本人+upcoming+容量内；取消=本人或主办方；签到/名单=主办方(用户主办=本人，群主办=群 admin)或平台 admin；**official 活动仅平台 admin 可建**，organizerId 服务端强制归属本人/本人所在群 |
| 商城 | 兑换=单人单事务（扣积分+锁库存+建单）；**订单详情仅本人或 admin 可读**（含兑换码）；商品管理=admin |
| 卡片 | 抽卡=单事务：锁用户行→余额→加权抽(按 dropRate)→入账 |
| 积分 | `earn/spend` 授权目标用户=本人（admin 例外），内部统一走 `PointService.spendInTx` |
| 宿舍 | 问卷提交/计算/确认均需登录；管理操作需 admin（状态机与并发仍有改进空间，见 §6） |
| 用户统计 | `getUserStatsFn` 仅 admin（service 内抛权限拒绝） |

### 4.4 数据库（Drizzle, PostgreSQL）

表结构见 `src/server/database/schemas/*.ts`（pgEnum + pgTable + relations）。
结构变更流程：改 schema → `pnpm db:generate` / `pnpm db:push`。

域 → 表 一览：

| 域 | 表 |
| --- | --- |
| 用户 | `users`, `user_profiles` |
| 群组 | `groups`, `group_members`, `group_posts` |
| 反馈 | `feedbacks`, `feedback_status_logs` |
| 互动 | `reactions`, `replies`（target 为游离 UUID，完整性靠 service） |
| 公告/订阅 | `bulletins`, `subscriptions` |
| 活动 | `activities`, `activity_participants`（(activityId,userId) 唯一） |
| 积分 | `point_transactions`（余额 = SUM(amount)） |
| 卡片/成就 | `cards`, `user_cards`（userId+cardId 唯一）, `achievements`, `user_achievements` |
| 商城 | `redeem_items`, `redeem_orders`（含 `quantity`） |
| 宿舍 | `dorm_cycles`, `dorm_questionnaires`, `dorm_rooms`, `dorm_student_profiles` |

> 注意：最近新增了 `redeem_orders.quantity` 列；部署升级请先执行 `pnpm db:push`。

---

## 5. 安全基线（已修复项与审计要点）

本次框架收敛重点修复的问题（均以 file:line 可查）：

1. **群组自我审批**：`approveGroup` 由“群内 admin 即放行”改为平台 `role==='admin'`
   （学生创建者不能再把自己拉起的 pending 群直接审核通过）。
2. **活动签到伪造 / 名单泄露**：`checkIn`/`cancelRegistration`/`listParticipants`
   补上 session 与主办方校验；`official` 活动与 organizerType/organizerId 不再信任客户端。
3. **私密/未审核群组内容泄露**：`getGroupBySlug`、帖子读写、成员列表统一加
   群组可见性/成员门槛；`memberCount`/`postCount` 修正（只统计已批准成员，
   postCount 实现而非恒 0）。
4. **兑换与抽卡不再可并发双花/超卖**：整段业务放进单一 DB 事务，用户行
   `SELECT … FOR UPDATE` 串行化扣款；库存用条件递减（`stock >= qty`），
   不再有 0→-1 变成“无限库存”的翻转；订单补记 `quantity`。
5. **商城订单 IDOR**：`getOrder` 仅本人或 admin；兑换码不再人人可读。
6. **抽卡掉率**：按 `dropRate` 加权抽取（替换 uniform `random()`）；奖池为空先拒绝、不扣分。
7. **伪事务**：反馈创建/状态流转、群组创建等 `db.transaction` 内主写改为走 tx。
8. **会话安全**：`getCurrentUser` 每次回源校验（停用/删除立即失效、角色实时）；
   登录校验 `isActive`；`redirectUrl` 开放重定向移除（跳转目标前端白名单化）。
9. **匿名反馈作者泄露**：非管理员视角剥离匿名作者。
10. **错误/文案一致性**：失败不再静默“成功”提示；错误信息统一中文（用户可见层）。
11. **依赖与配置收敛**：移除未使用的 `jsonwebtoken`/`JWT_SECRET`；本地安装允许
    esbuild/@parcel/watcher 构建脚本（`pnpm-workspace.yaml`）。
12. **前端 UI 一致性**：旧 magic-string 守卫改为 redirect；删除失效导航组件
    （TopNav/MobileNav/全局死搜索）与未使用的 Drawer/CommentList；Modal 可访问性、
    FilterPanel 分组标题、Toast 标签、404/错误页中文等。

**已知仍待改进（roadmap）**：登录/兑换/抽卡限流；宿舍状态机与问卷并发约束、
房间调整校验；回复/点赞目标表加真实外键；反馈匿名作者剥离后详情页“作者卡”的
视觉占位；评论/通知等新功能入口；`pnpm db:push` 建议换成正式迁移。

---

## 6. 事务与并发约定

- 所有“扣钱/扣库存/发权益”必须用 `db.transaction`，且先
  `pointQueries.lockUser(userId, tx)` 锁用户行再读余额（`PointService.spendInTx`）。
- 库存递减用条件更新：`UPDATE redeem_items SET stock = stock - $q WHERE id=$i
  AND stock >= $q`（`stock=-1` 表示无限，永不递减）。
- 抽卡在事务内重读奖池、按权重逐张抽取并 upsert；奖池为空在扣分前拒绝。
- Drizzle executor 类型：`DbClient | DbTransaction`（`database/client.ts`），
  查询函数把 `executor` 作为末位参数（默认 `db`），保证事务内读写同源。

---

## 7. 前端接入新页面/新功能的 Check-list

1. 在 `shared/contracts/<domain>.ts` 定义 Zod 输入 + 派生类型；
2. 在 `server/services/<Domain>Service.ts` 写业务逻辑（开头先拿 session 用户）；
   写操作明确角色/归属规则，涉及金额/库存走 §6 约定；
3. 在 `server/functions/<domain>.ts` 暴露 `createServerFn`：动作型失败 `throw`，
   读取型保持 envelope（二选一，见 §4.1）；
4. 在 `app/routes/_authed/<domain>/` 下放路由文件，列表页复用
   `SectionHeader + FilterPanel + EmptyState + 分页` 骨架；
5. 需要入口的话在 `layout/navItems.ts` 加导航项；只用新式命名类 + 语义令牌；
6. `pnpm exec tsc --noEmit` + `pnpm build` 通过后再提交。
