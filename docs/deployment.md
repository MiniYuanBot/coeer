# COEER Deployment Guide

This project is a TanStack Start SSR application with Server Functions and PostgreSQL.
It should be deployed as a Node.js service behind a reverse proxy such as Nginx.

## 一键发布到现有阿里云服务器

本仓库已经适配 `ssh aliyun` 上正在运行的 `/var/www/coeer` 和 `coeer.service`，沿用现有 Nginx 与 PostgreSQL，不需要 Docker。

在本机项目目录执行：

```sh
npm run deploy
```

使用 pnpm 时执行 `pnpm run deploy`；`pnpm deploy` 是 pnpm 自带的工作区部署命令，不会运行本项目的发布脚本。Windows PowerShell 如遇脚本执行策略限制，可使用 `pnpm.cmd run deploy`。仅查看计划可执行 `pnpm run deploy --dry-run`，无需提前手动 build。

该命令发布**当前工作区代码**，包含尚未提交的改动，不要求先 push 到 GitHub。流程为：

1. 本机 TypeScript 检查、远程服务与运行时检查。
2. 上传源码包至独立版本目录，使用固定 pnpm 和 `--frozen-lockfile` 安装依赖。
3. 使用服务器现有 `.env`，再次检查环境、社区表结构、类型并构建；缺少通知、密码找回或收藏表时停止并提示升级命令。
4. 在 `127.0.0.1:13000` 临时启动新版本，检查数据库表结构、SSR 登录页和实际 CSS 资源；预检进程随后关闭。
5. 原子切换 `current` 链接，写入专用 systemd drop-in 并重启 `coeer.service`。
6. 核对线上 `/healthz` 的版本 ID 和数据库状态；失败则恢复此前链接、启动配置并重启旧版本。

这是**带健康检查和自动回滚的重启发布**，切换时可能短暂中断连接，不承诺零停机。新发布的 systemd 配置将停止等待限制为 15 秒，超时后由 systemd 终止残留进程；发布脚本为重启保留 120 秒等待，以兼容回滚时恢复的旧服务配置。失败的构建不会停止当前应用。发布过程中不执行数据库迁移、种子数据或数据库清理；应用回滚也不会回滚数据库。

### 已有数据库的社区功能升级

若站内通知显示 `Failed query ... from "notifications"`，同时收藏页出错，应先检查服务器是否遗漏社区迁移。在服务器当前应用目录（使用版本发布时为 `/var/www/coeer/.deploy/current`，首次部署前为 `/var/www/coeer`），使用服务对应的 Node/pnpm 运行：

```sh
NODE_ENV=production pnpm db:check:community
# 缺表时，先备份数据库，再执行以下可重复运行的增量升级：
NODE_ENV=production pnpm db:upgrade:community
NODE_ENV=production pnpm db:check:community
```

升级脚本和 `deploy/migrations` 必须来自待发布的新版本。升级仅创建 `notifications`、`password_resets`、`bookmarks` 及索引，不清理已有账号、帖子、积分或收藏。完成后重新发布；若仍报错，应继续检查数据库访问权限与实际表结构。不要用 `seed:all` 修复生产库，种子命令只用于开发环境。

旧演示数据中的六种 `placehold.co` 卡片/商城图片地址会在展示时映射为随站点发布的 `/demo/*.svg`，无需重跑种子或改写生产图片数据；其他自定义图片地址保持原值。

常用命令：

```sh
npm run deploy:check               # 只读检查，不上传或重启
npm run deploy:list                # 查看线上、回滚、就绪与未就绪版本及占用大小
npm run deploy:delete -- <ID>       # 删除指定未使用版本（永久删除该版本目录）
npm run deploy -- --dry-run         # 查看计划，完全不连接服务器
npm run deploy -- --prepare         # 上传、构建和隔离预检，不切换线上
npm run deploy -- --activate <ID>   # 再次预检并发布此前准备的版本
npm run deploy:rollback            # 恢复当前版本记录的上一版本
npm run test:deploy                # 发布包排除规则、失败恢复及并发锁测试
```

版本查看不会上传或创建版本目录。删除使用同一把发布互斥锁，禁止删除当前线上版本、当前记录的直接回滚版本及发布目录外的路径；可删除其他就绪或构建失败的版本。删除不会重启服务、执行数据库命令，或沿 `.env`/依赖链接删除版本目录外的文件。删除较早版本后，其他历史版本中指向它的更早回滚记录可能失效；保留需要的回滚链再清理。命令不会自动批量删除，也不提供强制删除保护版本的选项。

### 部署数据库命令

在本机项目目录运行以下命令，复用同一个 `aliyun` 配置：

```sh
pnpm run deploy:db:status                         # 只读查看数据库、版本、所需表和就绪状态
pnpm run deploy:db:backup                         # 创建并验证 PostgreSQL 备份
pnpm run deploy:db:backups                        # 只读列出备份文件、时间和大小
pnpm run deploy:db:upgrade                        # 先自动备份，再执行本地增量 SQL
pnpm run deploy:db:seed --user test@example.com    # 先自动备份，再为已有账号补齐演示数据
```

PowerShell 如有限制，使用 `pnpm.cmd run ...`。各命令支持 `--config <JSON 文件>` 和 `--dry-run`；例如 `pnpm run deploy:db:seed --user test@example.com --dry-run` 只显示计划，不连接服务器，也不执行 SQL。pnpm 脚本参数直接追加，**不需要**在参数前插入 npm 的 `--` 分隔符。

命令通过 SSH 将本地操作脚本发送到服务器执行，在当前线上版本目录读取服务器生产环境配置和数据库依赖。本机 `.env`、连接密码和数据库内容不会上传；即使未重新发布应用，也可以使用新脚本修复旧版本的数据库。数据库就绪检查失败或服务停止时仍可运行修复命令。

升级和导入共用发布互斥锁，自动备份使用 `pg_dump` 自定义格式，并由 `pg_restore --list` 验证。备份失败或验证失败会阻止后续变更；备份保存在服务器 `/var/www/coeer/.deploy/backups`，目录权限为 700、文件为 600。备份命令要求服务器安装与数据库版本兼容的 PostgreSQL 客户端，密码通过进程环境传递，不写入命令行参数或输出。未验证完的 `.partial` 文件不会列为可用备份。

`deploy:db:upgrade` 按文件名顺序执行本地 `deploy/migrations` 中的增量 SQL，然后检查社区表结构。现有 SQL 可重复运行；新增到此目录的 SQL 也应保持幂等并自行包裹事务。该命令不执行 `db:push` 或全库同步，不会复制本机数据库。

`deploy:db:seed` 只接受**已存在且启用的账号邮箱**，在一个事务内创建该账号的私密演示群、示例帖子、收藏和通知，补齐最多三种已有卡片及一项演示成就，并一次性添加 200 测试积分；空卡池会创建一张零权重演示卡。重复执行不会增加积分或卡片数量，不重置密码、角色、已修改内容或通知已读状态，不修改其他用户的持有记录。演示群若被手动公开，脚本会中止，避免继续向公开空间导入。它不开放 `--clean`，也不会绕过原有 `seed:all` 的生产限制。

首次使用或有新表时，顺序为：

```sh
pnpm run deploy:db:status
pnpm run deploy:db:upgrade
pnpm run deploy
pnpm run deploy:db:seed --user test@example.com
```

导入数据后刷新页面即可，不需要再 build 或重启。应用回滚不会撤销数据库写入；这些命令不提供自动恢复或全库清理。

配置位于 `deploy/aliyun.json`。如服务器目录、服务名或 Node/pnpm 安装位置变化，可新建忽略入 Git 的 `deploy/aliyun.local.json`，只填写需要覆盖的字段：

```json
{
  "host": "aliyun",
  "root": "/var/www/coeer",
  "service": "coeer.service",
  "pnpm": "/root/.nvm/versions/node/v26.7.0/bin/pnpm",
  "pnpmVersion": "10.33.4",
  "port": 3000,
  "previewPort": 13000
}
```

`pnpm` 同目录下必须存在 `node`。项目现在要求 Node 26.x、npm 11.x 和 pnpm 10.33.4；
仓库中的 `deploy/aliyun.json` 使用 `/root/.nvm/versions/node/v26.7.0/bin/pnpm`，
其他服务器需先安装对应运行时，或在 `deploy/aliyun.local.json` 填入实际 Node 26 路径。
脚本在预检时拒绝其他 Node 主版本，不会自动安装运行时；生产启动使用锁文件中的 srvx 0.11.7。

服务器布局：

```text
/var/www/coeer/
  .env                         # 现有服务器配置，原地保留
  .deploy/
    lock                       # 发布/回滚互斥锁
    current -> releases/<ID>   # 首次成功发布后创建
    releases/<ID>/
      .env -> /var/www/coeer/.env
      dist/                    # Linux 服务器构建的产物
      ready.json               # 通过预检的版本记录
      previous.json            # 上一版本及启动配置记录
      previous-unit.conf       # 上一版专用 drop-in（如存在）
      preview.log              # 该版本的隔离预检日志
```

原始部署目录的源码、依赖和构建产物保持可用，因此首次发布也能回滚到现有部署。专用覆盖文件为 `/etc/systemd/system/coeer.service.d/90-coeer-release.conf`；其他覆盖文件若修改启动目录或启动命令，预检会停止并要求先核对，不会直接覆盖。版本目录默认保留，脚本不自动清理历史版本。上一版哈希静态资源会复制到新版本，降低已打开页面更新时的资源缺失风险。

本机 `.env*`、SSH/云凭据、`*.pem`、`*.key`、本机配置、`node_modules` 和 `dist` 不会上传。SSH 使用已有 `aliyun` 身份和主机验证设置，不修改 SSH、防火墙或数据库权限。服务器需要 Python 3、无交互 sudo、现有 Node/pnpm，以及能访问依赖仓库的网络。

健康检查的成功响应形如：

```json
{"status":"ok","release":"<ID>"}
```

数据库不可用或社区所需表/字段缺失时返回 HTTP 503 与通用状态，不输出连接字符串或错误详情。发布成功意味着应用回环端口与 systemd 检查通过；公网 DNS、证书和 Nginx 配置沿用现状，可另用公网地址检查。

以下为首次搭建服务器的手动流程；已接入一键发布后，请使用上述命令，避免在原始目录手动 `git pull` 后重启。

## Requirements

- Linux server, Ubuntu 22.04+ recommended
- Node.js 26.x and npm 11.x (recommended Node 26.7.0)
- pnpm 10.33.4
- PostgreSQL 14+
- Nginx
- A domain name pointing to the server

## 1. Install Runtime Dependencies

```sh
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib

curl -fsSL https://deb.nodesource.com/setup_26.x | sudo -E bash -
sudo apt install -y nodejs

corepack enable
corepack prepare pnpm@10.33.4 --activate
```

## 2. Prepare PostgreSQL

```sh
sudo -u postgres psql
```

```sql
CREATE DATABASE coeer;
CREATE USER coeer_user WITH ENCRYPTED PASSWORD 'change-this-password';
GRANT ALL PRIVILEGES ON DATABASE coeer TO coeer_user;
\q
```

For PostgreSQL 15+, also grant schema privileges after connecting to the database:

```sh
sudo -u postgres psql -d coeer
```

```sql
GRANT ALL ON SCHEMA public TO coeer_user;
\q
```

## 3. Clone and Configure

```sh
sudo mkdir -p /var/www
sudo chown -R "$USER":"$USER" /var/www
cd /var/www
git clone https://github.com/your_name/coeer.git
cd coeer

cp .env.example .env
```

Edit `.env`:

```env
NODE_ENV=production
PORT=3000
CLIENT_URL=https://coeer.example.com

DATABASE_URL=postgresql://coeer_user:change-this-password@localhost:5432/coeer
DB_POOL_MIN=1
DB_POOL_MAX=10

SESSION_SECRET=replace-with-production-secret

VITE_APP_NAME=COEER
VITE_API_URL=
```

Generate a strong secret:

```sh
openssl rand -base64 48
```

## 4. Install, Validate, Build

```sh
pnpm install --frozen-lockfile
pnpm check:env
pnpm db:push
pnpm build
```

For a demo environment, you may seed test data:

```sh
pnpm seed:all
```

The local seed commands are disabled in production. For an existing deployed test account, use `pnpm run deploy:db:seed --user <email>` from your local project; it creates a verified backup before importing data.

## 5. Run with systemd

Copy and edit the service file:

```sh
sudo cp deploy/systemd/coeer.service /etc/systemd/system/coeer.service
sudo nano /etc/systemd/system/coeer.service
```

Make sure `WorkingDirectory` points to your deployed project directory and the Node.js path in `ExecStart` matches the installed runtime:

```sh
which node
```

Then start the service:

```sh
sudo systemctl daemon-reload
sudo systemctl enable coeer
sudo systemctl start coeer
sudo systemctl status coeer
```

View logs:

```sh
journalctl -u coeer -f
```

## 6. Configure Nginx

Copy and edit the Nginx config:

```sh
sudo cp deploy/nginx/coeer.conf /etc/nginx/sites-available/coeer
sudo nano /etc/nginx/sites-available/coeer
sudo ln -s /etc/nginx/sites-available/coeer /etc/nginx/sites-enabled/coeer
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Enable HTTPS

```sh
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d coeer.example.com
```

After HTTPS is enabled, ensure `.env` has:

```env
NODE_ENV=production
CLIENT_URL=https://coeer.example.com
```

The session cookie is marked `secure` in production, so HTTPS is required for login to work correctly.

## 8. Update Deployment

已接入一键发布的服务器，在本机运行 `npm run deploy`。下列命令仅适用于未接入版本目录管理的手动部署；数据库变更应独立评估、备份并使用迁移，不作为每次 UI 发布步骤。

```sh
cd /var/www/coeer
git pull
pnpm install --frozen-lockfile
pnpm check:env
pnpm build
sudo systemctl restart coeer
```

## 9. Health Checks

```sh
curl -I http://127.0.0.1:3000
curl -I https://coeer.example.com
sudo systemctl status coeer
journalctl -u coeer -n 100 --no-pager
```

## Notes

- Keep `.env` only on the server. Never commit it.
- `pnpm db:push` is convenient for early deployment. For a stable production database, prefer Drizzle migrations with `pnpm db:generate` and `pnpm db:migrate`. Schema changes (e.g. new columns such as `redeem_orders.quantity`) require running `pnpm db:push`/migrations on the production database.
- Back up PostgreSQL before schema changes and before running any clean seed command.
