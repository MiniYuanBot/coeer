# COEER 测试

在 Node 26 下运行 `pnpm test`，先执行统一 Vitest 测试，再执行已有的发布脚本测试。
`pnpm typecheck` 检查类型，`pnpm build` 验证客户端、服务端与生成路由；`pnpm check`
依次执行全部检查。Windows PowerShell 可使用对应的 `pnpm.cmd` 命令。

## 覆盖范围

- `tests/integration/community.test.ts`：注册、登录、退出、角色回源校验和停用即时生效；
  反馈审核、匿名作者保护；私密群组的成员审批与内容可见性；活动容量、名单隐私和签到
  权限；兑换数量、积分扣减、库存、订单归属及数据库错误时的事务回滚。
- `tests/navigation.test.ts`：登录回跳、外部地址和反斜杠绕过防护、服务 URL 参数校验。
- `tests/integration/spaces.test.ts`：社区登录和管理员守卫、预约 Cookie 账号隔离、
  CSRF、请求大小、幂等与预约归属。
- `tests/integration/spaces-runtime.test.ts`：预约配置与社区数据库隔离、内嵌引擎单实例。
- `scripts/deploy.test.mjs`：已有的发布参数、路径、配置及打包规则。

## 数据库边界

社区测试通过 PGlite 在内存中运行 PostgreSQL。建表 SQL 从 COEER 的实际 Drizzle schema
生成，查询、业务服务、外键、唯一约束和事务均真实执行，仅替换 HTTP Session 容器及
数据库连接。每个用例重置数据，不读取本机 `.env`，不连接开发或生产数据库。

PGlite 使用单连接，这些测试不证明生产 PostgreSQL 多连接之间的竞争条件。真实部署、
官方预约系统写入和外部网络不在测试范围内。预约集成测试使用 Mock 和临时 SQLite，
不依赖原 OpenSpace 项目的完整测试套件。
