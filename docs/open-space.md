# 空间预约

OpenSpace 已作为 COEER 的服务模块集成，侧栏“服务 → 空间预约”进入 `/spaces`。
所有页面直接位于 COEER 的文件路由，使用 `components/coeer` 的标题、筛选、表单、
卡片、徽章、分页、弹窗与通知。没有独立 UI 目录、专属 CSS 或第二套路由组件。

## 功能与路径

| 路径 | 功能 |
| --- | --- |
| `/spaces` | 按空间类型、人数、名称和位置筛选；查询指定日期的空闲状态 |
| `/spaces/:spaceId` | 日历、连续时段选择、容量校验与幂等提交 |
| `/spaces/bookings` | 当前预约账号的记录与自动更新 |
| `/spaces/bookings/:bookingId` | 处理时间线、确认结果、开门密码及申请取消 |
| `/spaces/identity` | 验证预约账号、修改预约密码与退出预约身份 |
| `/admin/spaces` | 运行概览与处理开关 |
| `/admin/spaces/catalog` | 空间配置、发布与预约开关 |
| `/admin/spaces/bookings` | 审核预约、处理异常和人工核对 |
| `/admin/spaces/allowlist` | 白名单、预约权限和密码重置 |
| `/admin/spaces/history` | 同步记录、任务队列与操作审计 |

旧的 `/spaces/login`、`/spaces/account`、`/spaces/admin` 会重定向到对应的新路由。
空间筛选、日期、搜索及管理记录分页保存在 URL 中。

需要先登录 COEER。COEER 使用邮箱账号，没有已验证的学号字段，因此保留原预约账号与
学号白名单，验证后可在模块内管理预约。不会由邮箱或用户填写的学号自动授予预约权限。
管理接口同时要求 COEER 管理员角色和预约管理员身份。

预约 Cookie 按 COEER 用户分别命名，限定在 `/api/open-space`；切换社区账号不会继承
前一个账号的预约身份。退出预约身份不退出社区。API 每次重新校验 COEER 会话、角色和
停用状态，然后交给预约引擎执行 CSRF、归属、白名单及业务校验。

## 本地运行

项目统一要求 **Node.js 26.x、npm 11.x、pnpm 10.33.4**，推荐 Node `26.7.0`。
Windows 切换方式见 [README](../README.md#windows切换到-node-26)。

```sh
pnpm install
pnpm dev
```

开发环境默认按需启动内嵌 Mock 引擎和预约 Worker，只在本机随机端口监听；无需另开
OpenSpace 项目。数据默认保存在 `data/openspace.sqlite`，与 COEER 的 PostgreSQL 独立。
模拟账号：普通用户 `0000000001` / `0000000001@114514`，预约管理员
`9999999999` / `demo-admin-2026`。模拟账号仅在本地 Mock 环境初始化。

## 复用现有 OpenSpace 服务

要继续使用既有预约、账号和官方接入，可将 COEER 连接到现有后端：

```dotenv
OPENSPACE_BACKEND_URL=http://127.0.0.1:3001
OPENSPACE_APP_ORIGIN=https://openspace.example.com
```

`OPENSPACE_APP_ORIGIN` 必须等于该后端原本配置的 `APP_ORIGIN`。地址只接受 HTTP(S)
origin，不带路径、用户名或查询参数。COEER 会代理 `/api/open-space/*` 到其 `/api/*`，
不向它转发社区 Cookie。配置外部地址后不启动内嵌引擎，不复制或重置已有数据库。

## 内嵌官方接入

原 OpenSpace 的后端配置在 COEER 中统一增加 `OPENSPACE_` 前缀；不会覆盖主站的端口、
数据库或 Session 设置。生产模式默认关闭官方接入，禁止初始化演示账号。

```dotenv
OPENSPACE_APP_ENV=production
OPENSPACE_APP_ORIGIN=https://coeer.example.com
OPENSPACE_DATABASE_PATH=/persistent/coeer/openspace.sqlite
OPENSPACE_ADAPTER_MODE=official
OPENSPACE_ADMIN_STUDENT_ID=9999999999
OPENSPACE_ADMIN_BOOTSTRAP_FILE=/private/openspace-admin.json
OPENSPACE_OFFICIAL_CONNECTOR_URL=http://127.0.0.1:3002
OPENSPACE_OFFICIAL_CONNECTOR_KEY_FILE=/private/connector-key.json
OPENSPACE_OFFICIAL_WRITES_ENABLED=false
```

管理员初始化文件为 `{"password":"至少12位的私密密码"}`，仅首次创建管理员时使用；
密钥、官方凭据和审批文件存放在仓库外。Connector 使用原官方配置、公开字段白名单及
写入授权协议；仅打开环境开关不会绕过这些授权。Production 必须使用隔离 Connector。
Staging 也支持直接适配器，参数包括 `OPENSPACE_OFFICIAL_CONFIG_FILE`、
`OPENSPACE_OFFICIAL_SESSION_FILE`、`OPENSPACE_OFFICIAL_SESSION_KEY_FILE`、
`OPENSPACE_OFFICIAL_PUBLICATION_FILE` 和 `OPENSPACE_OFFICIAL_WRITES_FILE`。

SQLite 与 Worker 保持单实例，数据库必须放在本地持久磁盘。发布预检实例应使用独立
SQLite 文件或复用既有外部 API，避免两个 Worker 同时操作同一数据库。发布时需要保留
`OPENSPACE_DATABASE_PATH` 对应的数据目录；主站发布脚本不搬迁 SQLite 或私密配置。

## 运维与检查

CLI 同样读取 `.env` 的 `OPENSPACE_` 配置：

```sh
pnpm spaces:ops check
pnpm spaces:ops backup /private/openspace-backup.sqlite
pnpm spaces:connector
pnpm spaces:official probe
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

预约引擎保留独立适配器、缓存、Worker、幂等申请、容量校验、过期数据保护、异常核对、
审核及恢复规则。官方结果不明确时继续核对，不自动重复创建。
仅保留 COEER 网关与内嵌引擎的必要集成测试；原站的独立运维、故障场景和历史清理测试
不再迁入。它们与社区账号、内容权限、活动和积分兑换测试共用 `pnpm test`，详见
[测试说明](testing.md)。

页面位于 `src/app/routes/_authed/spaces` 与 `src/app/routes/_authed/admin/spaces`，
数据状态位于 `src/app/hooks/useSpaces.tsx`，公共 UI 位于 `src/app/components/coeer`。
后端引擎位于 `src/server/open-space`，不依赖相邻的 `../open-space` 工作目录。
