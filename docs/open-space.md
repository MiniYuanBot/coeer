# 空间预约

## 入口与身份

| 路径 | 功能 |
| --- | --- |
| `/spaces` | 目录筛选、指定日期空闲查询 |
| `/spaces/:spaceId` | 日历、连续时段选择与提交 |
| `/spaces/bookings` | 本人预约记录 |
| `/spaces/bookings/:bookingId` | 进度、时间线、开门密码与取消 |
| `/admin/spaces` | 运行概览与处理开关 |
| `/admin/spaces/catalog` | 空间配置与发布开关 |
| `/admin/spaces/bookings` | 审核、异常处理与人工核对 |
| `/admin/spaces/allowlist` | 学号白名单及预约权限 |
| `/admin/spaces/history` | 同步记录、队列与审计 |

预约共用主站身份，昵称与密码在 `/profile` 修改。管理员由主站 setup 创建，不初始化第二个
预约管理员。普通用户的学号从登录邮箱提取；白名单按学号设置自动提交、每次审核或禁止预约。
未加入白名单的用户仍可查看和取消自己的已有预约。

平台管理员使用保留学号 `0000000000`，无需加入学生白名单；普通用户不能注册或通过白名单获得它。
各管理员的预约与额度按独立账号计算，仍遵守时间、容量、冲突和处理开关。
API 每次核对主站会话；网关只传递服务端签发的短期 HMAC 身份，
引擎继续检查签名、CSRF、归属与白名单，不信任客户端身份头。

## 本地运行与数据库

按[开发环境](development.md)配置 PostgreSQL 和主站后运行：

```sh
pnpm db:push
pnpm db:setup
pnpm dev
```

预约后台使用同一个 `DATABASE_URL`，自动在 `BOOKING_DB_SCHEMA`（默认 `coeer_spaces`）初始化表。
数据库账号需要建 schema 和表的权限。旧 SQLite 文件不会自动导入。
后台在服务开始监听后启动，不依赖页面访问；构建和静态预渲染不会启动后台。
启动失败时预约 API 返回 503，修复配置后重启服务，查询不会反复尝试初始化。

## 官网规则与处理

正常配置使用 `rulesSource: "upstream"`，空间目录、权限和连续时段跟随官网响应。
默认最多提前 7 天，允许今天至今天加 7 天，共 8 个日期（北京时间）。
调整 `BOOKING_ADVANCE_DAYS` 并重启可改变查询、提交和同步范围。

后台每 5 分钟逐日同步范围内所有空间。页面只读取 PostgreSQL，不因缺少或过期缓存临时请求官网。
官网读取发生 `NETWORK` 或 `TIMEOUT` 时最多尝试 3 次，间隔 1 秒、2 秒；认证失败、权限拒绝、
限流和维护响应不走此重试。日志只记录接口阶段、次数、耗时及安全错误码，不记录凭据或响应正文。

提交先在本地检查冲突、保留占位并持久化任务，返回 202 和申请号。
后台独立读取官网状态、校验表单、提交并核对结果；关闭详情页不会中止任务。
详情页每 3 秒刷新，独立核对成功后才显示“已确认”。幂等重试返回原申请，
已确认返回 201，明确失败返回带申请号的 409；结果不明时继续核对，不自动重复创建。

`rulesSource: "contract"` 保留旧静态授权协议兼容。`upstream` 不把本地 `rules`、公开清单或
历史日期当作官网规则；协议中的字段、回执和状态映射仍用于调用官网。

## 本机校园网直连

开发默认使用 `official`，需要校园网访问官网；不会建立 VPN 或代理。
登录入口为 `http://smart.coe.pku.edu.cn:8500/show/#/v1702279899865050`。
私密文件放在 Git 忽略的 `.coeer-local`，路径和开关写入 `.env.local`：

```dotenv
BOOKING_PRIVATE_DIR=./.coeer-local
CAMPUS_API_CONFIG_FILE=./.coeer-local/official.json
CAMPUS_BOOKING_FORM_FILE=./.coeer-local/writes.json
CAMPUS_ACCOUNT_FILE=./.coeer-local/account.enc.json
CAMPUS_ACCOUNT_KEY_FILE=./.coeer-local/account-key.json
CAMPUS_COOKIE_FILE=./.coeer-local/session.enc.json
CAMPUS_COOKIE_KEY_FILE=./.coeer-local/session-key.json
CAMPUS_ALLOW_HTTP=true
CAMPUS_WRITE_ENABLED=true
```

主配置内已有完整表单协议时可省略 `CAMPUS_BOOKING_FORM_FILE`。
账号与会话使用 AES-256-GCM 加密，密钥分文件保存。这里的账号用于官网服务身份，
不是 COEER 用户密码。`last-probe.json` 保存不含个人信息的最近一次查询摘要。

```sh
pnpm spaces:campus login
pnpm spaces:campus probe
pnpm spaces:campus probe 2026-10-23
```

`login` 解密官网账号，通过正常网页登录并保存加密 Cookie；`probe` 只读查询，不创建或取消预约。
默认后续请求复用 Cookie，失效后重新运行登录。本地租约未过期不代表官网仍接受该 Cookie。
可用 `CAMPUS_BROWSER_EXECUTABLE` 指定 Chrome/Chromium 路径。

## 自动恢复会话

```dotenv
CAMPUS_AUTO_RELOGIN=true
CAMPUS_RELOGIN_STATE_FILE=./.coeer-local/recovery-state.json
CAMPUS_COOKIE_LEASE_RENEWAL=true
```

自动重登还需上述账号、账号密钥、会话和会话密钥配置。
恢复只在同步、详情核对和连接检查等读取边界触发，写入不会因认证失败自动重发。
新会话核对官网身份后才安装；验证码、MFA 或账号错误会停止自动尝试，
冷却时间和每日次数限制持久化。租约续期只延长仍有效的本地租约，不延长官网 Cookie 有效期。

## 官方接入与部署

`BOOKING_*` 管预约业务，`CAMPUS_*` 管官网账号和接口，`CONNECTOR_*` 管独立连接器。
旧 `OPENSPACE_*` 变量会报错，不提供回退别名。生产环境使用隔离 Connector，staging 可直连。

```dotenv
BOOKING_RUNTIME_ENV=production
BOOKING_ALLOWED_ORIGIN=https://coeer.example.com
BOOKING_DB_SCHEMA=coeer_spaces
BOOKING_DATA_SOURCE=official
BOOKING_ADVANCE_DAYS=7
CONNECTOR_URL=http://127.0.0.1:3002
CONNECTOR_TOKEN_FILE=/private/connector-key.json
CAMPUS_WRITE_ENABLED=true
```

主站和 Connector 共用通信令牌文件；它与官网加密凭据、会话密钥不同。
Connector 使用同一官方配置与表单协议，主站和 Connector 均需开启写入开关。

```sh
pnpm spaces:connector
pnpm spaces:official probe
```

接口模板见 [official.upstream.example.json](../config/official.upstream.example.json)，
协议模板见 [official.meeting-contract.example.json](../config/official.meeting-contract.example.json)。
将官网用户 ID 替换为实际核对的服务身份；私密表单文件结构为 `{ version: 1, contact, contract }`。
使用独立表单文件时主配置保留 `writes.enabled=false`，加载器合并后开启写入，
运行环境仍需 `CAMPUS_WRITE_ENABLED=true`。HTTP 官网接口须显式设置 `CAMPUS_ALLOW_HTTP=true`。

可通过 `BOOKING_ENGINE_URL` 使用独立预约引擎，此时须配置双方共用的
`BOOKING_ENGINE_SIGNING_SECRET`，引擎必须支持当前 COEER 签名身份。
内嵌模式自动生成进程级密钥。独立引擎的数据库需单独运维，主站清空命令不跨服务清理。

## 运维

配置加载顺序见[开发环境](development.md#环境文件)，修改后重启服务。
`BOOKING_SYNC_ENABLED` 与 `BOOKING_SUBMISSIONS_ENABLED` 可分别覆盖后台同步和用户提交开关。

```sh
pnpm spaces:ops check
pnpm spaces:ops backup /private/coeer-spaces.dump
pnpm spaces:campus probe
```

预约专用备份只包含预约 schema，依赖 `pg_dump` 与 `pg_restore`；不在 PATH 时可设置 `PG_BIN_DIR`。
全库管理及无备份清空见 [deployment.md](deployment.md)。
清空数据库会移除本地预约处理线索，保留服务器私密文件，不会取消官网预约。
