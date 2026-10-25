# 部署与数据库管理

COEER 作为 Node.js SSR 服务运行，由 Nginx 反向代理，数据库使用 PostgreSQL。
运行环境为 Node.js 26.x、npm 11.x 和 pnpm 10.33.4，推荐 Node 26.7.0。

## 发布到现有服务器

默认目标是 SSH 别名 `aliyun`、目录 `/var/www/coeer`、服务 `coeer.service`。
在本机项目根目录运行：

```sh
pnpm run deploy
pnpm run deploy:check
pnpm run deploy --dry-run
```

必须使用 `pnpm run deploy`，`pnpm deploy` 是 pnpm 自带命令。
PowerShell 可使用 `pnpm.cmd run ...`；pnpm 参数直接追加，不插入 npm 的 `--` 分隔符。

发布使用当前工作区代码，包含未提交的改动。脚本先检查本机类型和服务器运行时，再上传源码，
在独立目录安装锁定依赖、检查环境与表结构、构建，并在隔离端口预检。
通过后切换 `current` 链接并重启服务；健康检查失败时恢复旧版本和启动配置。
切换时可能短暂中断连接。发布不执行迁移、种子或数据库清空，应用回滚也不回滚数据库。

静态资源模板由 Nginx 处理 gzip，并清空上游 Accept-Encoding，避免 srvx 每次请求实时进行高质量 Brotli 压缩；哈希资源缓存一年。发布目录权限为 0700，不能直接改 Nginx root 托管静态文件，需先设计限定公开产物的目录权限及回滚流程。
发布脚本不会自动安装或重载 `deploy/nginx/coeer.conf`。

```sh
pnpm run deploy:list
pnpm run deploy --prepare
pnpm run deploy --activate <版本ID>
pnpm run deploy:rollback
pnpm run deploy:delete <版本ID>
```

`list` 显示版本、状态、时间和大小；`prepare` 只构建与预检；`activate` 发布指定版本。
`delete` 永久删除未使用的历史版本，保护当前线上及直接回滚版本，不修改数据库或重启服务。
清理较早版本前应保留需要的回滚链。

## 部署目标配置

公共配置位于 `deploy/aliyun.json`。需要覆盖时，新建 Git 忽略的 `deploy/aliyun.local.json`：

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

`pnpm` 同目录须有 `node`。可通过 `--config <JSON文件>` 选择其他目标。
服务器需要 Python 3、无交互 sudo、可用的 SSH 配置和依赖仓库访问权限。
本机 `.env*`、`.coeer-local`、密钥、本机配置、依赖和构建产物不会上传。

```text
/var/www/coeer/
  .env                       服务器配置
  .deploy/
    lock                     发布与数据库写入共用的锁
    current -> releases/ID   当前版本
    backups/*.dump           PostgreSQL 备份
    releases/ID/
      .env -> /var/www/coeer/.env
      dist/
      ready.json
      previous.json
      previous-unit.conf
      preview.log
```

## 数据库状态与升级

```sh
pnpm run deploy:db:status
pnpm run deploy:db:upgrade
```

数据库命令通过 SSH stdin 发送本地操作代码，在服务器当前版本中加载生产配置和依赖，
无需先发布网站。`status` 只读检查数据库及社区表结构；`upgrade` 自动备份后按文件名执行
`deploy/migrations` 中的增量 SQL，再检查表结构。备份失败会阻止升级。

通知、收藏、密码找回、图片存储缺表或缺少新的成就条件类型时，先升级再发布。

2026-10-26 的群主、公告通知与头像功能还需要 `20261026-community-roles.sql`。
升级会把现有群组创建者设为群主（必要时恢复其成员记录）；创建者账号已删除时，选择最早加入的已批准管理员或成员。
原管理员超过 3 人时保留最早加入的 3 人，其余降为普通成员；群主不占管理员名额。
脚本新增 `users.avatar_url`、`bulletins.notification_mode` 和单群主唯一索引，可重复执行且不会覆盖之后的群主转让。
请先运行上述带备份的 `deploy:db:upgrade`，再发布新版本；本地开发库可运行 `pnpm db:upgrade:community`。

新入口：设置 → 头像；成长 → 每日积分；管理后台 → 用户统计 → 调整积分。
每日积分按北京时间统计实际奖励流水，后台手动调整不计入每日任务。
`20261023-achievements-images.sql` 保留已有成就与解锁记录，增加可配置条件及图片存储。
也可在包含相应迁移文件的服务器应用目录执行：

```sh
NODE_ENV=production pnpm db:check:community
NODE_ENV=production pnpm db:upgrade:community
NODE_ENV=production pnpm db:check:community
```

直接执行升级前自行备份。增量升级补齐通知、密码重置、收藏、图片存储与成就条件类型，不替代所有版本的结构迁移。
新环境可用 `db:push` 创建社区表；已有生产表的其他变更应单独生成、审阅并应用迁移。

## 创建唯一管理员

在本机的交互式终端运行：

```sh
pnpm run deploy:setup
```

按提示输入管理员邮箱、昵称、密码和密码确认。邮箱可使用非学生邮箱；密码至少 8 位，
最多 72 字节，输入不回显。密码在本机生成 bcrypt 哈希后经 SSH stdin 传递，不写入代码、
配置文件或命令行参数。数据库仅新增一个启用的管理员，不注入帖子、群组、积分或其他样例。

已有管理员时 setup 会拒绝执行，包括已停用的管理员；邮箱已被普通账号使用时也会拒绝，
不会提升权限或覆盖密码。重复或并发运行不会创建多个管理员。
线上演示种子入口已移除，本地开发种子禁止在生产环境运行。
主站内嵌预约引擎不自动创建演示账号或独立预约管理员。

管理员登录凭据保存在社区 `users.email` 与 `users.password_hash`，不是 `.env` 中的配置。
`DATABASE_URL` 的用户名与密码只用于连接数据库。登录后可在 `/profile` 修改密码，
忘记密码可使用已配置邮件服务的找回流程。

已有管理员的邮箱目前需要定向修改数据库。先核对账号 ID，修改社区邮箱；
若存在预约身份镜像，同时修改镜像邮箱并保留其 ID，避免分离历史预约身份。
修改开发种子文件不会改变已有线上账号。

## 无备份清空数据库

本机项目目录中先只读核对目标、表和行数，再执行清空：

```sh
pnpm run deploy:db:clear
pnpm run deploy:db:clear --execute
```

清空会删除全部社区账号，包括管理员，以及社区与预约数据：反馈、群组、帖子、回复、活动、
通知、积分、卡片与卡池、成就规则、兑换、宿舍、预约记录、白名单、预约设置、目录和缓存等。
保留表结构、索引、约束和迁移版本；服务器环境文件、官网凭据、密钥、已有备份与发布版本保留。
此命令不创建备份，也不会取消官网已有预约。

默认只读预览，`--execute` 才会删除。执行时共用发布锁，暂停原本运行的服务，
在事务中锁定显式列出的应用表并清空，再恢复服务；失败会回滚并尝试恢复原运行状态。
服务原本停止时不会启动。缺表、异常命名空间或范围外外键引用会阻止清空，不使用级联删除。

完成后用 `deploy:setup` 创建管理员。服务恢复后的后台同步可能重新生成场地目录、设置、缓存和日志；
这些是运行数据，不是演示种子。`--dry-run` 仅显示本机计划，不连接服务器，也不读取线上行数。
本地清空命令见 [development.md](development.md#本地数据库)。

## 备份列表与删除

```sh
pnpm run deploy:db:backup
pnpm run deploy:db:list
pnpm run deploy:db:backups
pnpm run deploy:db:delete coeer-db-20261022120000000-a1b2c3d4.dump --dry-run
pnpm run deploy:db:delete coeer-db-20261022120000000-a1b2c3d4.dump
```

删除示例中的文件名需替换为列表中的完整名称。`list` 与 `backups` 等价，按新到旧显示目录、
文件名、时间（UTC）和字节大小。列表与删除不建立数据库连接，但需要当前版本的 Node 与运行依赖。

备份默认位于服务器 `/var/www/coeer/.deploy/backups`，随部署 `root` 调整。
使用 PostgreSQL `pg_dump` 自定义格式，`pg_restore --list` 验证后才发布为 `.dump`，
未完成的 `.partial` 不列入备份。服务器须安装兼容版本的 PostgreSQL 客户端。
目录权限为 700、文件为 600，包含业务数据及密码哈希，不通过网页公开。
查看备份中的记录，需要恢复到独立数据库后查询。

`deploy:db:delete` 立即永久删除指定备份文件，不要求 `--execute`；拒绝路径、通配符和符号链接。
它不改变当前数据库。网站历史版本使用 `deploy:delete` 管理，两种删除互不替代。

## 首次搭建服务器

以下命令以 Ubuntu、项目目录 `/var/www/coeer` 为例，域名和运行时路径需替换为实际值。
先安装 Node.js 26.7.0 和 pnpm 10.33.4，再安装 PostgreSQL、Nginx 与客户端工具：

```sh
sudo apt update
sudo apt install -y git postgresql postgresql-client nginx
sudo -u postgres createuser --pwprompt coeer_user
sudo -u postgres createdb --owner=coeer_user coeer
sudo mkdir -p /var/www/coeer
sudo chown "$USER":"$USER" /var/www/coeer
git clone https://github.com/MiniYuanBot/coeer.git /var/www/coeer
cd /var/www/coeer
cp .env.example .env
chmod 600 .env
openssl rand -base64 48
```

填写 `.env` 的数据库连接、随机 `SESSION_SECRET`、`CLIENT_URL` 和 `APP_URL`。
生产 origin 必须使用 HTTPS；预约的 Connector 与私密文件配置见 [open-space.md](open-space.md#官方接入与部署)。

```sh
pnpm install --frozen-lockfile
NODE_ENV=production pnpm check:env
NODE_ENV=production pnpm db:push
NODE_ENV=production pnpm db:setup
pnpm build
sudo cp deploy/systemd/coeer.service /etc/systemd/system/coeer.service
sudo nano /etc/systemd/system/coeer.service
```

在 service 中核对 `WorkingDirectory` 与 `ExecStart` 的 Node、srvx 和构建入口路径。
管理员仍通过同一套交互式 setup 创建，不使用固定账号。

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now coeer
sudo cp deploy/nginx/coeer.conf /etc/nginx/sites-available/coeer
sudo nano /etc/nginx/sites-available/coeer
sudo ln -s /etc/nginx/sites-available/coeer /etc/nginx/sites-enabled/coeer
sudo nginx -t
sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d coeer.example.com
```

## 服务检查

### 2026-10-26 发布记录（北京时间）

- 当前发布版本：`20261025165601151-c6a3fae9ba`（版本 ID 使用 UTC 时间），包含用户确认的原始 PNG 删除及相关引用调整。直接回滚目标为首轮性能发布 `20261025164745856-c954a3cb84`；优化前版本 `20261025112305010-326a41a7c7` 也保留。`pnpm run deploy:rollback` 每次恢复当前版本记录的上一版本。
- 使用现有 prepare/activate 流程完成安装、环境与表结构检查、类型检查、构建、隔离端口预检和上线健康检查。
- COEER 的 Nginx 1.24.0 TLS 站点已启用 HTTP/2、gzip、上游 keepalive 和哈希资源 immutable 缓存，保留原证书及 HTTPS 跳转。配置备份：`/var/backups/coeer-nginx/coeer-20261025T165037Z.conf`。应用回滚不会回滚 Nginx；如需恢复配置，使用此备份并先执行 `nginx -t`，再重载 Nginx。
- 未执行数据库迁移或修改业务数据。`20261025-concurrency-indexes.sql` 留待维护窗口执行，普通建索引会阻塞相关表写入，本次应用运行不依赖新增索引。
- 服务器本机 HTTPS GET 观测：旧主 JS Brotli TTFB 约 3,299 ms；部署后同一文件协商 gzip/br 返回 gzip，TTFB 约 51–53 ms；新入口 gzip TTFB 约 47–52 ms。协议、编码及运行负载不同（基线采集时正在准备新版本），该结果不是严格单变量基准或并发吞吐承诺。
- 线上健康检查、旧资源兼容、静态 404 缓存策略以及隔离浏览器登录页到公开首页导航通过；HTTP/2、本地字体/WebP 正常，无控制台错误。没有使用生产账号执行登录或积分写入测试。

```sh
curl http://127.0.0.1:3000/healthz
curl -I https://coeer.example.com
sudo systemctl status coeer
journalctl -u coeer -n 100 --no-pager
journalctl -u coeer -f
```

健康检查包含数据库及社区所需表结构。预约配置修改后需要重启服务；构建与静态预渲染不会启动预约后台。
