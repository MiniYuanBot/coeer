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

浏览器测试自动查找 Chrome、Chromium 或 Edge；未安装时跳过。也可指定可执行文件：

```powershell
$env:COEER_TEST_BROWSER = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
pnpm exec vitest run tests/replies.test.ts tests/markdown-editor.test.ts
```

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
