# 一键发布验证

验证日期：2026-10-15（Asia/Shanghai）。

已完成：

- 13 项发布自动测试通过：源码包排除敏感文件、参数校验、只读 dry-run、并发锁、预检失败保护、线上健康失败恢复、原始部署恢复和手动回滚事务。systemd 切换与失败恢复使用隔离临时目录及模拟服务执行器验证。
- 本机 TypeScript 检查、生产构建通过，客户端构建产物未包含新增健康检查的数据库配置或连接逻辑。
- `npm run deploy:check` 通过真实 `ssh aliyun` 验证了 `/var/www/coeer`、`coeer.service`、Node v20.20.2、pnpm 10.33.4 与现有登录页 HTTP 200。
- `npm run deploy -- --prepare` 在阿里云服务器独立版本目录完成锁文件安装、环境校验、TypeScript 检查与 Linux 生产构建。
- 隔离端口 `127.0.0.1:13000` 的新版本通过真实数据库 `SELECT 1` 就绪检查、版本 ID 核对、SSR 登录页检查及 CSS 字节比对；预检进程随后退出。

预检版本：`20261014174710612-74017fab44`。

本次没有切换生产版本，没有重启 `coeer.service`，没有修改原始 `.env`、Nginx 或数据库结构/内容。真实生产切换和真实服务回滚未执行；已有自动测试覆盖其控制逻辑。

使用方式见 [deployment.md](deployment.md)。默认 `npm run deploy` 会重新检查、构建并正式发布当前代码；`npm run deploy:rollback` 恢复上一版本。
