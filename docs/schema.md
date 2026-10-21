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

空间预约直接使用 `app/routes/_authed/spaces` 与 `app/routes/_authed/admin/spaces`
文件路由，复用 `components/coeer` 的公共组件，不设置独立 UI、CSS 或路由适配器。
`app/hooks/useSpaces` 只管理数据与预约身份；后端通过登录守卫下的
`/api/open-space/*` 进入保留的预约引擎。共享接口位于 `shared/contracts/spaces.ts`，
原预约领域类型保留在 `shared/open-space`。配置与运维见 [空间预约](open-space.md)。

### 1.1 目录导览

```
src/
├─ app/                        # 前端（表现层）
│  ├─ router.tsx               # createRouter + NotFound/Error 全局兜底
│  ├─ routeTree.gen.ts         # 自动生成，勿手改（vite dev/build 时重新生成）
│  ├─ routes/                  # 文件式路由（见 §2）
│  ├─ components/
│  │  ├─ coeer/                # 产品级 UI 体系
│  │  │  ├─ ui/                #   Button / Card / Badge / SearchInput / FilterPanel …
│  │  │  ├─ layout/            #   AppShell / Sidebar / CommandMenu / ThemeToggle …
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
├─ index.tsx                     # '/'：游客品牌页头 + 公开信息流；登录后进入 AppShell
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

- `/login`、`/signup` 属于公共认证区（居中窄表单，无外层卡片或工作区导航）；
  游客访问 `/` 时显示品牌、主题切换和登录/注册页头，接左对齐介绍与公开动态预览；
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
  （搜索 + 过滤组，状态写入 URL search params）→ 行列表/卡片网格/表格 →
  `EmptyState` → `Pagination`（上一页/下一页）。
- 分页、搜索条件都存在 **URL**（`validateSearch` + `loaderDeps`），刷新/分享
  可还原，返回键回到同一状态。

---

## 3. UI 设计体系（Linear 参考）

视觉规范以根目录 [DESIGN.md](../DESIGN.md) 的 token frontmatter 为准，
[.impeccable/design.json](../.impeccable/design.json) 补充动效、断点、色阶预览与
可独立渲染的组件示例。`PRODUCT.md` 记录产品约束；页面策略保留在对应 surface brief。

### 3.1 设计令牌（`styles/app.css`）

语义化 HSL 令牌同时驱动现有任意值类和命名工具类，具体值由 `app.css` 的
`:root` 与 `.dark` 定义，并逐项记录在 DESIGN.md；下表只说明角色。

| 令牌 | 用途 | 浅色 | 深色 |
| ---- | ---- | ---- | ---- |
| `--background / --foreground` | 画布 / 正文 | 白色 / 石墨 | 石墨 / 浅灰 |
| `--card / --card-foreground` | 独立表面 / 表面文字 | 白色 / 石墨 | 深灰 / 浅灰 |
| `--sidebar` | 导航区域 | 冷灰 | 更深石墨 |
| `--muted / --muted-foreground` | 辅助表面 / 弱文本 | 浅灰 / 中灰 | 深灰 / 灰白 |
| `--border` | 边框与分隔线 | 浅冷灰 | 暗灰 |
| `--primary / --primary-soft` | 主操作、链接 / 强调浅底 | 低饱和紫 / 极浅紫 | 浅紫 / 深紫灰 |
| `--primary-foreground / --ring` | 主按钮文字 / 键盘焦点 | 白色 / 主色 | 深色 / 主色 |
| `--danger / --success / --warning` | 错误 / 完成 / 待处理 | 红 / 绿 / 琥珀 | 提亮后的同语义色 |
| `--inverted / --inverted-foreground` | 兼容业务页的反相对比 | 石墨 / 白色 | 浅灰 / 石墨 |

`@theme inline` 映射为 `text-foreground`、`bg-card`、`border-border`、
`bg-primary-soft`、`text-muted-foreground` 等工具类，新代码使用命名类。
`.coeer-card`、`.coeer-container`、`.coeer-workspace`、`.coeer-focus`、
`.coeer-scrollbar`、`.coeer-kbd`、`.coeer-nav-link` 为跨页公共类。

字体保留 Inter（Google Fonts link）与中文系统字体回退。首次访问默认浅色；
`__root` 的防闪烁脚本只在 `localStorage.coeer-theme === 'dark'` 时添加
`<html class="dark">`，主题切换会保存明确选择，不再默认跟随系统深色偏好。

### 3.2 外壳（layout 体系）

- `AppShell`：lg（1024px）起固定 232px 左侧栏，内容顶部为 52px sticky 路径栏。
  主内容采用 `.coeer-workspace`，最大宽度 84rem；手机左右各留 16px 空隙。
- `Sidebar`：品牌、页面搜索、按“社区 / 服务 / 成长”分组的导航，平台管理员
  额外显示“管理”；底部为主题切换与用户/退出入口。当前导航用灰底与主色图标标识。
- 移动导航：lg 以下使用顶部按钮开启原生 dialog 抽屉，宽度 `min(288px, 86vw)`；
  打开时锁定背景滚动，支持关闭按钮、Esc、遮罩点击与选中页面后关闭。
- `CommandMenu`：搜索按钮或 Cmd/Ctrl+K 打开，按现有页面名称与路径过滤；支持
  方向键选择、Enter 跳转、Esc 关闭。它是页面导航，不提供全站内容搜索索引。
- 登录首页：主信息流与公开反馈使用分隔线；xl（1280px）起搭配 280px 信息侧栏，
  更窄时顺序堆叠。
- 游客首页：64px 品牌页头含主题切换与登录/注册，介绍和公开信息流左对齐，
  xl 起搭配 300px 信息侧栏。
- 认证页：不套工作区外壳，表单居中且最大宽度 340px，无外层卡片或左右品牌面板，
  右上角提供主题切换。

### 3.3 基础组件（`components/coeer/ui`）

| 组件 | 约定 |
| ---- | ---- |
| `Button` | primary/secondary/outline/ghost/danger；sm/md/lg/icon；默认 36px 高、6px 圆角；loading 禁用重复提交 |
| `Badge` | default/primary/success/warning/danger/muted；11px 字号、4px 圆角、轻底色与细边框 |
| `Card` | 8px 圆角、1px 边框，无投影或上浮；内边距由调用方决定 |
| `SectionHeader` | 23px 页面标题、描述与右侧操作，窄屏允许换行 |
| `FilterPanel` | 搜索与可换行的过滤组，渲染分组标题；选中项用 muted 背景与 aria-pressed |
| `SearchInput` | 36px 高、6px 圆角，前置搜索图标与可访问名称 |
| `EmptyState` | 小图标框、明确标题/说明与适用的下一步操作 |
| `Modal` | 原生 dialog，最大宽 512px、8px 圆角、20px 内边距；标题关联、Esc/关闭按钮/真正的遮罩点击关闭 |
| `Toast` | Provider + `useToast()`，沿用 Card 和语义 Badge，位于右下角 |
| `PageStatus` | hydration 后按真实路由 pending 状态显示顶部进度条 |

反馈页使用 `FeedbackCard variant="row"`：sm 起对齐状态图标、内容、状态徽章与
日期；手机将状态与日期移入内容元信息。列表更新提示和 aria-busy 同样在 hydration
后根据 pending 状态启用，空状态可清除筛选或提交反馈。范围、类型、关键词和分页
仍写入 URL。

所有交互保留 2px 焦点描边与 3px 间隙；状态同时使用文字或图形表达。色彩过渡通常
为 120ms，按钮为 150ms，尊重 `prefers-reduced-motion`。新增页面优先复用现有组件；
本次使用 CSS 与内联 SVG，未生成或新增 raster 视觉资产。

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
