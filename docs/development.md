# 开发环境

## 安装与启动

使用 Node.js 26.x、npm 11.x 和 pnpm 10.33.4，推荐 Node 26.7.0。
Windows PowerShell 若限制执行脚本，将下文的 `pnpm` 改为 `pnpm.cmd`。

```sh
git clone https://github.com/MiniYuanBot/coeer.git
cd coeer
pnpm install
cp .env.example .env
openssl rand -base64 48
```

PowerShell 中可用 `Copy-Item .env.example .env` 复制配置。安装并启动 PostgreSQL，
在 `.env` 填写 `DATABASE_URL`，将生成的随机值填入 `SESSION_SECRET`。
环境变量的完整说明见 [.env.example](../.env.example)。

```dotenv
PORT=3000
CLIENT_URL=http://localhost:3000
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/COEER
SESSION_SECRET=replace-with-at-least-32-characters
BOOKING_DB_SCHEMA=coeer_spaces
```

先创建社区表，再通过终端输入管理员邮箱、昵称和密码。setup 只创建一个管理员，
已有管理员时会拒绝执行；密码输入不回显。

```sh
pnpm db:push
pnpm db:setup
pnpm dev
```

开发服务默认在 `http://localhost:3000`。普通用户使用 `10 位学号@stu.pku.edu.cn` 注册，
管理员可使用其他邮箱。空间预约与主站共用登录身份；官方接入配置见 [open-space.md](open-space.md)。
未配置官方接入时，预约模块会报告配置错误。

## 环境文件

配置优先级为：进程环境、`.env.<NODE_ENV>.local`、`.env.local`、`.env.<NODE_ENV>`、`.env`。
本地命令未指定 `NODE_ENV` 时按 `development` 加载。修改配置后重启服务。

官网账号、加密会话、密钥与私密协议放在 Git 忽略的 `.coeer-local`，路径放在 `.env.local`。
这些文件不会随发布包上传，也不能通过 Vite 的静态资源入口访问。

## 本地数据库

社区表由 `src/server/database/schemas` 定义；预约后台启动时初始化独立的 `coeer_spaces`
schema。两者共用 `DATABASE_URL`，数据库账号需要相应的建表和 schema 权限。

```sh
pnpm db:studio
pnpm db:generate
pnpm db:migrate
pnpm db:check:community
pnpm db:upgrade:community
```

`db:studio` 浏览配置指向的数据库。`db:generate` 生成 Drizzle 迁移，`db:migrate` 应用迁移；
初期开发可使用 `db:push` 同步表结构。社区增量升级用于补齐通知、密码找回、收藏、图片存储及成就条件类型。

清空前先停止本地开发服务，再核对预览中的数据库名和表。清空会删除全部账号及社区、预约数据，
包括白名单、预约设置、卡池与成就规则，不创建备份；保留表结构和迁移版本。

```sh
pnpm db:clear
pnpm db:clear --execute
pnpm db:setup
```

默认只读预览；`--execute` 才会执行删除。`--dry-run` 只显示计划，不连接数据库。
重新启动预约后台后，同步可能重新产生目录、设置、缓存和日志。清理本地记录不会取消官网预约。

## 开发演示数据

本地演示种子仍可按模块运行，禁止用于生产库。若已经通过 setup 创建管理员，种子仍会创建
自己的演示账号；需要仅保留自定义管理员时，不要运行种子。

```sh
pnpm seed:users
pnpm seed:community
pnpm seed:feedbacks
pnpm seed:gamification
pnpm seed:all
```

种子按模块补齐账号、群组、反馈、活动、卡片、成就、积分与兑换样例。重复运行保留已有用户的
密码、昵称和角色，不重复发放演示积分；使用 `seed:all:clean` 会删除业务数据后重建样例。

| 演示角色 | 邮箱 | 密码 |
| --- | --- | --- |
| student | `0000000001@stu.pku.edu.cn` | `test1234` |
| moderator | `0000000002@stu.pku.edu.cn` | `demo1234` |
| admin | `admin@example.com` | `admin123` |

默认值在 `src/server/database/seed/testUsers.ts`，只用于创建开发演示账号，不代表线上凭据。

## 检查与生产构建

```sh
pnpm check:env
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

`check` 依次执行类型检查、测试与构建。具体命令和运行条件见 [testing.md](testing.md)。

```sh
pnpm preview
# 已构建的生产实例：
pnpm start
```

## 提交改动

从功能分支提交 Pull Request，说明问题、最终行为和检查方式。新增页面、权限或数据库操作前，
参照 [schema.md](schema.md)；生产操作参照 [deployment.md](deployment.md)。
