# COEER 测试

在 Node 26 下运行 `pnpm test`，先执行统一 Vitest 测试，再执行已有的发布脚本测试。
`pnpm typecheck` 检查类型，`pnpm build` 验证客户端、服务端与生成路由；`pnpm check`
依次执行全部检查。Windows PowerShell 可使用对应的 `pnpm.cmd` 命令。

## 覆盖范围

- `tests/integration/community.test.ts`：学生邮箱注册、登录、退出、昵称与密码修改、角色回源校验和停用即时生效；
  反馈审核、匿名作者保护；私密群组的成员审批与内容可见性；活动容量、名单隐私和签到
  权限；兑换数量、积分扣减、库存、订单归属及数据库错误时的事务回滚。
  同时覆盖帖子点赞持久化与并发切换、作者/群管理员权限、通知归属与事务回滚、
  审核结果、活动自动流转/管理员报名/重复报名/最后名额竞争，以及密码找回的限流、摘要、失效与发信失败。
  还覆盖收藏幂等、归属与可见性撤销、群内回复各读取入口与修改权限、跨帖父回复拒绝、
  群管理员审核与内容管理、最后一名管理员的并发保护，以及取消报名释放名额和状态刷新。
  多级回复覆盖顶层与子回复独立分页、四级父子关系、子回复计数、删除父回复后保留后代，
  以及退群后的深层回复访问撤销。
- `tests/markdown.test.ts`：求积分样例的 Markdown/行内与独立公式、普通换行与代码、
  错误公式降级，以及 HTML/危险链接/受信任 LaTeX 命令防护。
- `tests/replies.test.ts`：在真实 Chromium 中验证回复框的 Markdown/LaTeX 实时预览、编辑与取消，
  多级回复的发布/编辑/删除、失败重试与子回复加载更多，以及八级回复在桌面、390px 手机和深色模式下的层级与宽度。
  使用隔离的接口替身验证交互，真实持久化与权限由社区集成测试验证；浏览器查找规则与下项相同。
- `tests/post-content.test.ts`：通过真实 Chromium 检查长帖展开/收起、底部渐变、短帖完整
  显示、上下标位置、分数线厚度、公式字体，以及 390px 窄屏与深色模式。自动查找本机
  Chrome/Chromium/Edge，也可用 `COEER_TEST_BROWSER` 指定可执行文件；未安装浏览器时跳过。
- `tests/integration/seed-data.test.ts`：种子幂等、保留已改密码与昵称、反馈时间顺序、
  官方活动主办方、状态覆盖、公告目标和本地演示图片。
- `tests/integration/community-upgrade.test.ts`：从旧表结构执行真实增量迁移、重复升级保留数据，
  并验证缺表/缺字段时拒绝就绪；`tests/health.test.ts` 检查健康响应及错误信息脱敏。
- `tests/media-preview.test.ts`：真实 Chromium 中屏蔽外部占位图服务，验证六张旧演示图片改用
  本地 SVG，覆盖桌面、手机深色模式、图片边界与容器匹配、自定义图片和加载失败后换图恢复。
- `tests/private-path.test.ts`：项目内 `.coeer-local` 与仓库外私密文件可用，公开目录被拒绝。
- `tests/navigation.test.ts`：登录回跳、外部地址和反斜杠绕过防护、服务 URL 参数校验。
- `tests/development.test.ts`：生成路由文件不反过来触发生成器，保留源路由更新及 hook 行为。
- `tests/startup.test.ts`、`tests/startup-api.test.ts`：服务器监听后无页面访问也启动后台、
  单实例与关闭、生产入口启动及静态预渲染跳过；查询不会启动或重试失败的后台，未就绪返回 503。
- `tests/integration/spaces.test.ts`：社区身份签名和管理员守卫、学号白名单、
  CSRF、请求大小、幂等、预约归属与并发容量保护；管理员保留学号、预约与额度隔离、
  普通用户伪造保留学号被拒及管理员降权。
- `tests/integration/spaces-runtime.test.ts`：预约与社区复用 PostgreSQL、预约表命名空间隔离、
  内嵌引擎单实例、失败回滚、嵌套事务、多连接事务串行化、工人领取与租约恢复、
  数据库版本保护及异步官方写入权限守卫。
- `tests/integration/spaces-authentication.test.ts`：加密账号与会话、并发恢复只登录一次、
  人工验证和网络冷却跨重启生效，以及失败写入不自动重放；启动后首个连接断开或时段请求
  超时，Worker 在同一轮同步内恢复并保存完整快照，取消信号传入首次认证检查。
- `tests/integration/spaces-http.test.ts`：本地 HTTP/1.1 服务器模拟旧站点拒绝连接复用，
  验证连续读取资料与空间目录均成功且没有重试；首次连接断开和单次读取超时的有限重试、
  重试耗尽、退避取消、失败日志脱敏，以及写入和 HTTP 拒绝响应不重试，不依赖真实校园站点。
- `tests/integration/spaces-upstream.test.ts`：真实 PostgreSQL 与合成官方适配器验证
  目录自动发布及权限撤销、每轮完整日期同步、查询不触发官网访问、提前预约天数及
  统一日期边界、偏移网格上的长时段申请、白名单和幂等。
- `tests/integration/spaces-submission.test.ts`：提交先持久化并立即返回申请号，慢速官网不阻塞
  进入详情；后台独立处理、幂等、进度读取、失败/待审批/待核对状态、断开请求及重启后恢复。
  排队不能当作已确认预约。
- `scripts/deploy.test.mjs`：已有的发布参数、路径、配置及打包规则。
- `deploy/test_remote.py`：Linux 发布/回滚事务、Node 26 检查及缺少社区表结构时禁止构建和切换服务；
  版本列表只读、删除未使用/失败版本、当前与直接回滚版本保护、路径和符号链接隔离，
  数据库命令使用线上目录/生产配置且不重启服务。
- `scripts/database.test.mjs`：备份通过环境传递凭据、排除无关 libpq 环境、仅发布验证通过的私有备份、
  失败清理临时文件、备份列表只读/拒绝链接目录，以及备份失败时阻止迁移。
- `tests/integration/deployment-database.test.ts`：真实 PostgreSQL 中验证指定账号的演示数据导入、
  并发幂等/一次性积分、保留密码和编辑/已读状态、拒绝未知/停用用户、失败事务回滚及备份前置阻断。

## 数据库边界

所有本地开发与自动测试均连接 `.env` 中 `DATABASE_URL` 指定的真实 PostgreSQL，
不再使用 PGlite、SQLite 或临时替代数据库。运行测试的数据库账号需要创建 schema 的权限。
社区测试的建表 SQL 从 COEER 的实际 Drizzle schema 生成，查询、业务服务、外键、
唯一约束和事务均真实执行，仅替换 HTTP Session 容器及数据库连接。

每个测试文件创建以 `coeer_test_` 开头、含随机 UUID 的独立 schema。重置和清理只针对
该夹具实际创建的 schema，绝不清理 `public`、开发账号、历史预约或 `.env` 配置。
预约集成测试也在独立 PostgreSQL schema 上运行，官方预约网络使用 Mock。

日常运行中社区表保留既有 schema，预约表存放在 `coeer_spaces` schema，使用同一个
`DATABASE_URL`。`BOOKING_DB_SCHEMA` 可调整预约表的命名空间。预约事务通过
PostgreSQL 事务锁串行化容量/限额校验和队列领取，所有查询异步执行，不阻塞 Node 线程。
原 SQLite 文件不会自动导入 PostgreSQL；保留文件可供单独的数据迁移。

自动测试不触达官方预约系统，也不会自动提交真实预约。真实网络验收须显式运行
校园网测试命令，详见预约接入文档。
