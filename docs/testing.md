# COEER 测试

在 Node 26 下运行 `pnpm test`，先执行统一 Vitest 测试，再执行已有的发布脚本测试。
`pnpm typecheck` 检查类型，`pnpm build` 验证客户端、服务端与生成路由；`pnpm check`
依次执行全部检查。Windows PowerShell 可使用对应的 `pnpm.cmd` 命令。

## 覆盖范围

- `tests/integration/community.test.ts`：学生邮箱注册、登录、退出、昵称与密码修改、角色回源校验和停用即时生效；
  反馈审核、匿名作者保护；私密群组的成员审批与内容可见性；活动容量、名单隐私和签到
  权限；兑换数量、积分扣减、库存、订单归属及数据库错误时的事务回滚。
- `tests/navigation.test.ts`：登录回跳、外部地址和反斜杠绕过防护、服务 URL 参数校验。
- `tests/integration/spaces.test.ts`：社区身份签名和管理员守卫、学号白名单、
  CSRF、请求大小、幂等、预约归属与并发容量保护。
- `tests/integration/spaces-runtime.test.ts`：预约与社区复用 PostgreSQL、预约表命名空间隔离、
  内嵌引擎单实例、失败回滚、嵌套事务、多连接事务串行化、工人领取与租约恢复、
  数据库版本保护及异步官方写入权限守卫。
- `tests/integration/spaces-authentication.test.ts`：加密账号与会话、并发恢复只登录一次、
  人工验证和网络冷却跨重启生效，以及失败写入不自动重放。
- `tests/integration/spaces-http.test.ts`：本地 HTTP/1.1 服务器模拟旧站点拒绝连接复用，
  验证连续读取资料与空间目录均成功且没有重试，不依赖真实校园站点。
- `tests/integration/spaces-upstream.test.ts`：真实 PostgreSQL 与合成官方适配器验证
  目录自动发布及权限撤销、90 天外按需查询与并发合并、偏移网格上的长时段申请、
  白名单和幂等，以及缓存刷新失败时停止提交。
- `scripts/deploy.test.mjs`：已有的发布参数、路径、配置及打包规则。

## 数据库边界

所有本地开发与自动测试均连接 `.env` 中 `DATABASE_URL` 指定的真实 PostgreSQL，
不再使用 PGlite、SQLite 或临时替代数据库。运行测试的数据库账号需要创建 schema 的权限。
社区测试的建表 SQL 从 COEER 的实际 Drizzle schema 生成，查询、业务服务、外键、
唯一约束和事务均真实执行，仅替换 HTTP Session 容器及数据库连接。

每个测试文件创建以 `coeer_test_` 开头、含随机 UUID 的独立 schema。重置和清理只针对
该夹具实际创建的 schema，绝不清理 `public`、开发账号、历史预约或 `.env` 配置。
预约集成测试也在独立 PostgreSQL schema 上运行，官方预约网络使用 Mock。

日常运行中社区表保留既有 schema，预约表存放在 `coeer_spaces` schema，使用同一个
`DATABASE_URL`。`OPENSPACE_DATABASE_SCHEMA` 可调整预约表的命名空间。预约事务通过
PostgreSQL 事务锁串行化容量/限额校验和队列领取，所有查询异步执行，不阻塞 Node 线程。
原 SQLite 文件不会自动导入 PostgreSQL；保留文件可供单独的数据迁移。

自动测试不触达官方预约系统，也不会自动提交真实预约。真实网络验收须显式运行
校园网测试命令，详见预约接入文档。
