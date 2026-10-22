# 空间预约

OpenSpace 已作为 COEER 的服务模块集成，侧栏“服务 → 空间预约”进入 `/spaces`。
页面直接使用主站文件路由和 `components/coeer` 的公共组件。

## 功能与身份

| 路径 | 功能 |
| --- | --- |
| `/spaces` | 按类型、人数、名称和位置筛选，查询指定日期的空闲状态 |
| `/spaces/:spaceId` | 日历、连续时段选择、容量校验与幂等提交 |
| `/spaces/bookings` | 当前 COEER 用户的预约记录与自动更新 |
| `/spaces/bookings/:bookingId` | 处理时间线、确认结果、开门密码与申请取消 |
| `/admin/spaces` | 运行概览与处理开关 |
| `/admin/spaces/catalog` | 空间配置、发布与预约开关 |
| `/admin/spaces/bookings` | 审核预约、处理异常和人工核对 |
| `/admin/spaces/allowlist` | 按学号设置自动提交、每次审核或禁止预约 |
| `/admin/spaces/history` | 同步记录、任务队列与操作审计 |
| `/profile` | 修改 COEER 昵称与密码 |

空间预约共用 COEER 登录身份，不再提供独立预约登录、预约密码或身份切换页面。
普通用户注册须使用 `xxxxxxxxxx@stu.pku.edu.cn`，其中 `xxxxxxxxxx` 为 10 位数字学号；
管理员由服务端创建，可使用其他邮箱。平台管理员直接拥有预约管理及本人预约权限，无需二次验证。
管理员统一使用保留学号 `0000000000`，无需加入学生白名单，原登录邮箱不变；普通用户不能注册
此学号或通过白名单获取它。预约记录和限额按各管理员的独立账号计算，仍遵守时间、容量、
冲突与处理开关等规则。

白名单只需填写学号与预约权限，不要求姓名；列表显示已关联 COEER 用户的当前昵称。
学生学号由登录邮箱提取，申请人信息由服务端带入，不能由浏览器改成他人身份。
未加入白名单的学生可以查看和取消自己的已有预约，但不能创建新预约。
密码与昵称统一在个人资料页修改；改密需验证当前密码，并使其他设备的旧会话失效。

旧 `/spaces/identity`、`/spaces/login` 重定向到目录，`/spaces/account` 重定向到个人资料，
`/spaces/admin` 重定向到预约管理。筛选、日期及分页保存在 URL 中。

API 每次重新校验 COEER 会话、角色、停用状态和密码版本。网关仅转发服务端签发的短期
HMAC 身份，不转发社区 Cookie，不接受浏览器伪造的身份头；引擎继续校验签名、CSRF、
预约归属、白名单和业务规则。

## 本地运行与 PostgreSQL

要求 **Node.js 26.x、npm 11.x、pnpm 10.33.4**，推荐 Node `26.7.0`。
Windows 切换方式见 [README](../README.md#windows切换到-node-26)。

```sh
pnpm install
# 先在 .env 配置真实 PostgreSQL 的 DATABASE_URL 和 SESSION_SECRET
pnpm db:push
pnpm dev
```

社区与预约使用同一个 `DATABASE_URL`。社区保留原表，预约后台启动时初始化到独立
`coeer_spaces` schema，可通过 `BOOKING_DB_SCHEMA` 调整；数据库账号需要创建
该 schema 与表的权限。预约查询与事务均异步执行，事务锁保证多连接下的容量与任务领取
原子性。旧 SQLite 文件不会自动导入 PostgreSQL，已有文件应保留供单独的数据迁移。

开发与部署默认使用 `official` 适配器。官方配置缺失时报告接入错误；Mock 仅在自动测试中
显式启用。开发服务器开始监听时自动启动内嵌预约 Worker；生产服务导入服务端入口时启动，
无需打开页面。Worker 只监听本机随机端口，无需另启 OpenSpace UI，普通源码 HMR 不会
重复创建或停止它。服务器关闭时清理后台任务、监听器与数据库连接。
静态构建和预渲染不会启动预约后台。启动失败会记录运行事件，预约 API 返回 503；
页面查询不会尝试重新启动，修复配置后需重启服务。

首次同步与后续定时同步都对官网资料、空间列表和时段读取的 `NETWORK` / `TIMEOUT`
最多尝试 3 次，失败后分别等待 1 秒、2 秒；各次请求仍受单次超时和整项操作的取消信号约束。
认证失效、权限拒绝、限流及维护响应不走此重试；预约初始化、校验、提交和取消也不自动重放。
终端的 `spaces.official.request_error` 记录接口名称、请求阶段、次数、耗时及安全的底层错误码，
`spaces.official.request_retry` 记录退避重试。同步失败审计另记目录/时段阶段与日期；日志不含
Cookie、账号密码、请求参数或官网响应正文。

自动测试也使用 `.env` 的真实 PostgreSQL，在带随机 UUID 的 `coeer_test_*` schema 中
执行、清理，不改开发表或历史预约，不使用 PGlite/SQLite。官方网络在自动测试中使用
Mock，测试包括权限、CSRF、幂等、归属、创建/取消和并发预约保护，详见
[测试说明](testing.md)。

## 官网规则

正常配置使用 `rulesSource: "upstream"`。开发与部署共用此规则来源，官网允许访问的
会议室会自动进入目录；权限被官网收回后同步隐藏并停止接受新预约。
连续时段按官网响应及表单校验处理，不再采用三间教室或每次 30 分钟的历史试运行范围。
时段网格可以从 08:15 等官网实际起点开始。

默认最多提前 **7 天**预约，允许今天至今天加 7 天，共 8 个日期（北京时间）。
日期输入、服务端查询与提交使用同一范围，越界请求会被拒绝。
可在 `.env.local` 设置 `BOOKING_ADVANCE_DAYS=7` 并重启，统一调整预约范围及后台同步范围。
后台独立运行，每 5 分钟逐日同步范围内所有空间；页面读取目录、时段与预约时只访问
PostgreSQL，不触发官网同步，缺失或过期缓存也不会改成按需访问官网。

提交先用本地预约记录检查冲突、保留占位并持久化后台任务，随即返回 202 和申请号。
页面立即进入预约详情，后台独立读取官网状态、执行表单校验、提交并核对结果；刷新或关闭
详情页不影响任务。原选择页在保存申请时停止时段轮询，避免把自己的占位误报为冲突。
详情页每 3 秒读取处理进度，只有独立核对成功才显示“已确认”；排队、待审批与结果待核对
均使用对应状态。幂等重试返回原申请；已确认返回 201，明确失败返回带申请号的 409。
官网结果不明确时保留申请及幂等键继续核对，不自动重复创建。
COEER 继续校验登录、学号白名单、预约归属、CSRF、幂等与并发占用。

`rulesSource: "contract"` 保留旧版静态授权范围兼容；正常配置应显式选择 `upstream`。
表单协议中的 `verifyFields`、`createFields`、回执与状态映射仍用于正确调用官网，
`upstream` 模式不把协议的本地 `rules`、公开清单或历史试运行日期当作官网规则；
统一的提前预约天数仍适用于所有适配器模式。

## 本机校园网直连

当前测试使用本机已有的校园网连接，不启动 VPN 或代理。真实网站登录入口为
`http://smart.coe.pku.edu.cn:8500/show/#/v1702279899865050`。
账号及密码只保存在项目内且已被 Git 忽略的 `./.coeer-local`，账号和会话均加密存储，密钥分文件保存；
不要将该目录、密码或登录会话加入 Git。

本地私密文件包括：

- `official.json`：官方接口、已授权服务身份与空间查询配置。
- `account.enc.json` / `account-key.json`：加密测试账号与密钥。
- `session.enc.json` / `session-key.json`：加密官方会话与密钥。
- `last-probe.json`：不含个人信息的最近一次空间查询摘要。

官网账号密码实际保存在 `account.enc.json` 中，使用 AES-256-GCM 加密，密钥单独放在
`account-key.json`；两者分别由 `CAMPUS_ACCOUNT_FILE` 和 `CAMPUS_ACCOUNT_KEY_FILE` 指定。
`pnpm spaces:campus login` 会在本机内存中解密账号密码，通过正常官网页面完成登录，
再把 Cookie 会话加密保存到 `CAMPUS_COOKIE_FILE`，对应密钥为 `CAMPUS_COOKIE_KEY_FILE`。
后续查询与预约复用 Cookie；只有重新登录时才需要读取账号密码。未配置自动重登时，
会话失效后需要手动运行登录命令。本地会话租约尚未过期，不代表官网服务端一定仍接受该 Cookie。

```sh
pnpm spaces:campus login
pnpm spaces:campus probe
pnpm spaces:campus probe 2026-10-23
```

`login` 执行一次正常网页登录并保存会话，随后检查连接；`probe` 只读查询空间与日期
状态，不创建或取消预约。目录可通过 `BOOKING_PRIVATE_DIR` 指定。

直连自动恢复需显式设置 `CAMPUS_AUTO_RELOGIN=true`，并配置
`CAMPUS_ACCOUNT_FILE`、`CAMPUS_ACCOUNT_KEY_FILE`、
`CAMPUS_RELOGIN_STATE_FILE`，同时保留已有加密会话与密钥配置。
恢复只在同步、详情核对和连接检查等读取边界触发，整个适配器工作流串行执行，
创建和取消不会因认证失败而自动重发。新会话独立核对固定官方身份后才安装；
验证码、MFA 或账号错误停止自动尝试，网络失败冷却与每日次数限制持久化。
可选 `CAMPUS_COOKIE_LEASE_RENEWAL=true` 仅在身份核对成功后续期仍有效的本地租约，
不延长官方 Cookie 有效期。调整这些配置后需重启开发服务。

共用官方路径与开关放在忽略的 `.env.local`，引用 `.coeer-local` 私密文件；开发模式使用本机 HTTP
origin 与校园网接口。普通用户的学号由 COEER 管理员加入白名单。此前已通过 COEER
完成三间教室的提交、确认和取消，记录见 [真实接入验收](coeer-official-acceptance.md)；
该记录是已发生的验证范围，当前目录与时段继续跟随官网响应。
项目尚未部署到未来的校内服务器；届时配置服务器路径、应用 origin 与隔离 Connector。

## 官方接入与部署

预约业务使用 `BOOKING_*`，官网账号与接口使用 `CAMPUS_*`，独立连接器使用 `CONNECTOR_*`。
主站、内嵌引擎及运维命令使用同一套变量，数据库复用主站 `DATABASE_URL`。
旧变量已移除，不提供别名或回退；出现旧 `OPENSPACE_*` 配置时会明确报错。
生产环境直接使用 COEER 管理员身份，不需要初始化第二个预约管理员账号。

```dotenv
BOOKING_RUNTIME_ENV=production
BOOKING_ALLOWED_ORIGIN=https://coeer.example.com
BOOKING_DB_SCHEMA=coeer_spaces
BOOKING_DATA_SOURCE=official
CONNECTOR_URL=http://127.0.0.1:3002
CONNECTOR_TOKEN_FILE=/private/connector-key.json
CAMPUS_WRITE_ENABLED=true
```

Production 要求隔离 Connector；staging 可使用直连适配器。两者使用相同的
`rulesSource: "upstream"` 官方配置和表单协议。直连时配置
`CAMPUS_API_CONFIG_FILE`、`CAMPUS_COOKIE_FILE`、
`CAMPUS_COOKIE_KEY_FILE` 和
`CAMPUS_BOOKING_FORM_FILE`。HTTP 接口还需显式配置
`CAMPUS_ALLOW_HTTP=true`。密钥、凭据与官方配置存放在被 Git 忽略的 `.coeer-local` 内。
主配置模板为 [official.upstream.example.json](../config/official.upstream.example.json)，
其中官网用户 ID 必须替换为实际核对的服务身份。表单协议模板为
[official.meeting-contract.example.json](../config/official.meeting-contract.example.json)，
其 `rules: []` 不增设本地房间、日期和时长范围。
私密 `CAMPUS_BOOKING_FORM_FILE` 的结构为 `{ version: 1, contact, contract }`，
`contract` 填入上述协议内容，`contact` 填写服务账号联系方式。
使用独立协议文件时主配置保留 `writes.enabled=false`，加载器合并后开启写入；
运行环境还需 `CAMPUS_WRITE_ENABLED=true`。生产 Connector 使用同样配置，
主站与 Connector 均须开启对应写入开关。

如使用 `BOOKING_ENGINE_URL` 指向外部预约引擎，该服务必须实现当前版本的 COEER
签名身份验证，并与网关配置相同的服务器私密 `BOOKING_ENGINE_SIGNING_SECRET`。
不支持直接连接仍要求独立登录的旧 OpenSpace 服务。内嵌模式自动生成进程级随机密钥，
无需手工配置。

## 运维与检查

主站与空间 CLI 共用环境文件加载顺序：现有进程变量优先，然后依次为
`.env.<NODE_ENV>.local`、`.env.local`、`.env.<NODE_ENV>` 和 `.env`。
未设置 `NODE_ENV` 的本地命令使用 `development`。官方规则与私密路径可放在 `.env.local`，
端口、origin 等环境差异放在对应环境文件；修改后重启服务。

```sh
pnpm spaces:ops check
pnpm spaces:ops backup /private/coeer-spaces.dump
pnpm spaces:campus probe
pnpm typecheck
pnpm test
pnpm build
```

备份使用 PostgreSQL 客户端 `pg_dump` / `pg_restore`，只针对预约 schema；客户端不在
PATH 时可设置 `PG_BIN_DIR`。备份与私密文件不由主站发布脚本搬迁。
预约引擎保留缓存、Worker、审核、过期状态保护与异常核对；官方结果不明确时继续核对，
不自动重复创建。

前端页面位于 `src/app/routes/_authed/spaces` 与
`src/app/routes/_authed/admin/spaces`，数据状态位于 `src/app/hooks/useSpaces.tsx`，
公共 UI 位于 `src/app/components/coeer`，后端位于 `src/server/open-space`；
运行时不依赖相邻的 `../open-space` 工作目录。
