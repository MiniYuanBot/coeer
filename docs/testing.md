# 检查命令

## 日常检查

在项目根目录使用 Node.js 26 运行。Windows PowerShell 可将 `pnpm` 替换为 `pnpm.cmd`。

```sh
pnpm check:env
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

`check:env` 校验配置；`typecheck` 检查类型；`test` 执行 Vitest 与 Node 部署脚本测试；
`build` 构建客户端、服务端和生成路由。`check` 依次执行类型检查、测试和构建。

## 按范围运行

```sh
pnpm test:watch
pnpm test:concurrency
pnpm exec vitest run tests/integration/community.test.ts
pnpm exec vitest run tests/integration/engagement.test.ts
pnpm exec vitest run tests/integration/gamification-admin.test.ts tests/admin-gamification.test.ts
pnpm exec vitest run tests/integration/deployment-database.test.ts
pnpm exec vitest run tests/integration/spaces-runtime.test.ts
node --test scripts/deploy.test.mjs scripts/database.test.mjs
```

数据库集成测试需要 `.env` 中可用的 PostgreSQL `DATABASE_URL`，连接账号须能创建 schema。
每个测试文件创建带随机 UUID 的 `coeer_test_*` schema，结束后只清理自己的 schema，
不会清理开发账号或正式业务数据。官方网络调用使用替身，不创建或取消真实官网预约。

并发专项覆盖请求过载、队列超时与恢复、积分防超支、抢兑回滚、批量成就同步和预约连接池隔离。
请求处理器默认最多并行 64 个；预约写事务队列最多等待 100 项、10 秒。超限返回 503 和 Retry-After，非幂等写操作不能无条件重试。新增索引位于 `deploy/migrations/20261025-concurrency-indexes.sql`，需在维护窗口通过既有数据库升级流程执行。

性能检查命令：`pnpm analyze` 生成构建及压缩体积报告；`pnpm test:performance` 使用生产构建、隔离测试 schema 和浏览器验证 SSR、导航、积分与按需资源；`node scripts/check-nginx.mjs` 验证本地 Nginx gzip 与缓存策略（通过 `NGINX_BIN` 指定二进制）。`node scripts/check-static-performance.mjs` 在 Linux/WSL 下测量锁定版本 srvx 的静态压缩耗时，不连接数据库。

图片转换使用 `node scripts/optimize-mascot.mjs <原始PNG路径>`，输出两种尺寸 WebP；原始 PNG 由调用方提供，不随网站发布。性能产物位于 Git 忽略的 `tmp/performance`。这些检查不是完整网站吞吐压测，线上部署观测见 [部署记录](deployment.md#2026-10-26-发布记录北京时间)。

浏览器测试自动查找 Chrome、Chromium 或 Edge；未安装时跳过。也可指定可执行文件：

```powershell
$env:COEER_TEST_BROWSER = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
pnpm exec vitest run tests/replies.test.ts tests/markdown-editor.test.ts
pnpm exec vitest run tests/workspace-ui.test.ts
```

`workspace-ui.test.ts` 使用真实前端组件与隔离 UI 数据检查工作区、主题、移动布局、浮层焦点和效果降级，
不连接业务数据库或预约官网。代表页面截图写入 `tmp/glass-review`；验收要求见
[UI/UX 规范](../.impeccable/ui-layout.md)。测试结果以本次运行日志为准，历史截图不替代回归。

## Linux 部署控制器

Python 控制器依赖 Linux 的 `fcntl`。在 Linux 项目目录运行：

```sh
pnpm run test:deploy
python3 -m unittest discover -s deploy -p 'test_*.py'
```

Windows 可在安装了 Ubuntu 24.04 的 WSL 中运行 Python 部分，按实际位置替换项目路径：

```powershell
wsl.exe --distribution Ubuntu-24.04 --cd /mnt/d/__Coding__/github/coeer --exec python3 -m unittest discover -s deploy -p test_remote.py
```

控制器测试使用临时目录与模拟进程，不连接服务器、不重启线上服务。
