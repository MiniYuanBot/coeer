# Unicode 校验与历史数据迁移

## 本次远程执行结果

2026-10-26（Asia/Shanghai），已通过 `deploy/aliyun.json` 指定的 SSH 部署连接，直接清理远程 COEER 数据库。本机业务库未执行迁移；数据库测试使用随机、独立的 `coeer_test_*` schema。

| 数据 | 扫描记录 | 修改记录 | 非法码点 |
| --- | ---: | ---: | ---: |
| 用户昵称 | 13 | 1 | 1 × U+200B |
| 群组帖子（标题、正文） | 25 | 1 | 3 × U+200B |
| 回复（含各级子回复） | 29 | 2 | 2 × U+200B |
| 反馈 | 14 | 0 | 0 |
| 反馈状态记录 | 36 | 0 | 0 |
| 公告 | 2 | 0 | 0 |
| 通知文本副本 | 22 | 0 | 0 |

以下转义表示实际码点，不是原文中的反斜杠：

| 字段 | 原文 | 修改后 |
| --- | --- | --- |
| 不合规昵称 | `\u200B` | `bad boy` |
| 帖子标题 | `\u200B` | `X` |
| 同一帖子的正文 | `\u200B\u200B` | `XX` |
| 两条回复各自的正文 | `\u200B` | 各为 `X` |

共更新 4 条记录、5 个文本字段。提交前与提交后全量复扫均无遗留不合规文本、未规范化昵称或昵称冲突；已创建 `users_name_unicode_key` 唯一索引。迁移没有执行账号删除、密码变更、关系重建、统计重算或时间戳更新。

远程审计 ID：`59ae00bc-46e6-47c0-b5af-a783e0e7765e`。

- 扫描报告 `scan-1792952781831.json` 已按用户要求从服务器删除。
- 全库备份：`/var/www/coeer/.deploy/unicode-data/run-fMnuny/coeer-db-20261025182849261-f02af59c.dump`
- 原文与回滚清单：`/var/www/coeer/.deploy/unicode-data/run-fMnuny/manifest.json`
- 提交后验证 `run-fMnuny/result.json` 和独立再次复扫报告 `scan-1792953225303.json` 已按用户要求从服务器删除；删除前验证结果为零不合规字段，线上服务健康检查通过。

删除范围仅为上述三份报告，数据库备份和原文回滚清单均已校验保留，回滚功能不受影响。

备份已经过 `pg_restore --list`、完整解码和 SHA-256 校验；锁内原文清单写盘、fsync、重新读取校验后才修改数据。备份包含敏感数据，保留在服务器私有运维目录，不提交到 Git。

本次只向远程安装了独立迁移工具并修改数据库，没有切换应用发布版本。本文涉及的前后端校验源码仍需随下一次应用发布上线；已运行的旧代码不会因为数据库清理自动更新。唯一索引已在远程生效，但它不能替代正文校验。

## 两套独立规则

### 昵称 / 用户名

COEER 的登录标识仍为邮箱，所有权及关系仍使用 UUID；本次给社区昵称增加唯一性，并不更换登录方式。

1. 原始输入先检查：只接纳字母/数字类别的兼容变体，以及 ASCII `_`、`-`、U+0020。其他空白、控制、格式字符、Emoji 和符号在 NFKC 前拒绝，不能由 NFKC 洗成合法空格或字母。
2. 再做 NFKC；结果只允许 `Unified_Ideograph` 汉字（包括扩展区）、〇、ASCII `A–Z/a–z/0–9/_/-` 和 U+0020。因此全角字母、数字等可规范化，其他语言字母及不在最终白名单的字符拒绝。
3. 禁止首尾空格和连续空格；不执行 trim，也不删除非法字符。
4. 规范化后按 Unicode 码点计数，长度为 1–63，普通空格计入。浏览器不使用 UTF-16 `maxLength=63` 截断扩展区汉字。
5. 唯一键是 NFKC 后的 ASCII 小写文本，保留每个普通空格；`Alice` 和 `ＡLICE` 重名，`a b` 和 `ab` 不重名。数据库 `normalize + translate + COLLATE "C"` 表达式唯一索引处理并发竞争，不依赖有竞态的“先查询、后写入”。
6. 注册界面目前不接收自选昵称，默认使用学号。若该默认名已被占用，服务端分配合法 UUID 后缀，避免昵称被抢占后无法用邮箱注册；自选昵称冲突则明确拒绝，不擅自改名。
7. 历史非法昵称以及规范化后的重复昵称改为 `bad boy`、`bad boy-2` 等。先预留所有合法唯一键，再分配可用后缀。重复键按 UUID 排序保留首个合法账号。合法但未规范化的昵称保存 NFKC 结果。既有 NULL 昵称视为未设置，保留可空模型；空字符串视为不合规。

### 帖子、评论与回复

不做 NFKC，不统一 trim，不解析后重写 Markdown。以下是明确的禁止集：

- U+0000–U+001F，保留 TAB（0009）、LF（000A）和紧跟 LF 的 CR（000D）；孤立 CR 拒绝。
- DEL 和 C1 控制字符：U+007F–U+009F。
- U+200B、U+2060、U+FEFF（正文任何位置的 BOM 均视为异常）。
- 显式双向控制：U+061C、U+200E、U+200F、U+202A–U+202E、U+2066–U+206F（含废弃格式控制）。
- 孤立 UTF-16 代理项和 Unicode noncharacter：U+FDD0–U+FDEF，以及各平面的 FFFE/FFFF。

保留其他正常字符，包括正常空白、标点、数学符号、Emoji、肤色修饰符、旗帜、Emoji tag 序列、U+200C、U+200D、U+FE0E/U+FE0F 及补充变体选择符。自然阿拉伯文、波斯文、印度文字不因脚本方向或连接符被拒绝。

Markdown 语法、代码围栏、行内代码和字面量 `\\u200B` 不会被解析或改写；**实际**禁止码点即使出现在代码块中也仍拒绝。新提交拒绝并报告码点与行列；历史数据才使用替换规则，每个禁止码点恰好变成一个大写 `X`。

## 写入入口与文件

| 范围 | 实现 |
| --- | --- |
| 共享用户名策略（也供独立部署 CLI 使用） | `src/shared/username-policy.mjs` |
| 共享正文判定、定位、迁移替换 | `src/shared/unicode.ts` |
| Zod 适配 | `src/shared/contracts/unicode.ts` |
| HTTP 输入契约 | `contracts/auth.ts`、`users.ts`、`groupPosts.ts`、`replies.ts`、`feedbacks.ts`、`bulletins.ts` |
| 服务端内部调用防护 | `AuthService`、`GroupPostService`、`ReplyService`、`FeedbackService`、`BulletinService`，以及对应写入 queries |
| 昵称冲突处理 / 默认昵称分配 | `database/queries/users.ts`、`utils/username-conflict.ts` |
| 原生输入实时错误 / 无障碍错误关联 | `UnicodeInput.tsx`、`Field.tsx` |
| Markdown 实时错误（显式启用） | `MarkdownEditor.tsx`、`GroupReplies.tsx` |
| 表单接入 | 个人资料、帖子创建/编辑、反馈创建/审核、公告创建/编辑 |
| 非 HTTP 写入 | 管理员配置 `scripts/admin-input.mjs`、`deploy/database.mjs`、SSH runner `scripts/deploy.mjs`、社区 seed |
| Drizzle 和 SQL | `database/schemas/users.ts`、`deploy/migrations/20261026-unicode-usernames.sql`、`scripts/upgrade-community.ts` |
| 扫描、迁移、审计、回滚 | `database/unicode-migration.ts`、`scripts/unicode-data.ts`、`scripts/unicode-remote.mjs` |

现有 TanStack Server Functions 的 inputValidator 继续使用共享 Zod 契约；服务层与持久化层同时防御绕过 HTTP 契约的调用。`users` 的密码、邮箱、角色、头像路径不受昵称白名单影响。其它业务对象（如群组名、预约空间名）未套用用户名规则。

没有新增运行时依赖。远程工具使用已有 TypeScript 转译器打包已审查的最小源文件，通过已有 SSH 配置执行；不上传本机 `.env`、凭据或整个工作区，也不切换线上应用版本。

## 迁移步骤与回滚

本机/指定 DATABASE_URL：

```sh
pnpm db:unicode scan --out .coeer-local/unicode/scan.json
pnpm db:unicode apply --report .coeer-local/unicode/scan.json
pnpm db:unicode verify
pnpm db:unicode rollback --manifest <apply 输出的 manifest.json>
```

按 `deploy/aliyun.json` 操作远程实际部署：

```sh
node scripts/unicode-remote.mjs scan
node scripts/unicode-remote.mjs apply <远程扫描报告路径>
node scripts/unicode-remote.mjs verify
```

本次迁移的精确回滚命令（确需恢复原始非法文本时才执行）：

```sh
node scripts/unicode-remote.mjs rollback /var/www/coeer/.deploy/unicode-data/run-fMnuny/manifest.json
```

`scan` 使用只读一致性快照，报告记录数、码点类型和次数、转义示例及全量文本指纹。`apply` 必须提供该报告，先备份，再取得表级写锁；锁内重新扫描的指纹必须与报告一致，否则整个操作拒绝，必须重新扫描。未知触发器或物化视图会阻止迁移，避免修改非文本字段或遗漏派生内容。

锁内保存精确原文后，单个事务仅更新白名单文本列、创建唯一索引并记录审计表 `unicode_migration_runs`。普通查询索引由 PostgreSQL 随 UPDATE 自动维护；项目搜索使用 ILIKE 原文查询，没有独立全文缓存。通知文本副本和反馈状态说明已纳入扫描。迁移不重发通知，不修改提及目标 UUID 或关联关系。

事务内复扫后提交，再从数据库做独立复扫并写入 `result.json`。重复 scan/apply 不会再次改写已合规数据。旧扫描报告与现状不符时不会强行执行。

回滚校验备份哈希、审计表记录及数据库身份，备份当前文本后，只恢复本次改过的字段。若其中任何字段已有后续编辑或记录被删除，整个回滚取消，不能覆盖后来内容。恢复后逐字段验证；重复回滚是无操作。本次迁移之前不存在的唯一索引会随回滚撤销；回滚恢复了非法历史文本，需要与应用版本安排配合。全库 `.dump` 是灾难恢复后备，不在正常文本回滚中覆盖业务库。

在生产环境应将应用校验发布与清理安排在同一维护窗口，避免旧版本继续提交非法正文。不要用 `drizzle-kit push` 绕过历史扫描与备份；SQL 唯一索引脚本遇到重名会失败，不会自动吞掉冲突。

## 测试

本次最终验证：`pnpm typecheck` 通过；`pnpm build` 通过；`pnpm test` 全部通过（42 个 Vitest 文件、509 个测试，另有 14 个 Node 部署/数据库测试，共 523 个）。`git diff --check` 通过。新增 72 个测试覆盖此次策略和前后端、迁移流程。

- `tests/unicode.test.ts`：原始特殊空白、NFKC、首尾/连续空格、扩展区汉字长度、大小写键、控制码点、Emoji、多语言、Markdown/代码、多个连续禁止码点、统计及重复清理。
- `tests/integration/unicode.test.ts`：真实 PostgreSQL 并发唯一性、默认注册昵称冲突、服务及 query 绕过防护、完整 CLI 的备份/清理/复扫/重复执行、冲突回滚拒绝与原文精确恢复、非文本字段保持不变。
- `tests/markdown-editor.test.ts`：真实 Chromium 中实时提示、阻止提交、保留原始输入、Emoji/多语言正常提交、昵称码点长度。
- 原有社区、部署、种子数据测试继续覆盖邮箱登录、权限、关系和管理员初始化兼容性。PostgreSQL 本身不允许 text 中存储 NUL；该码点的新输入拒绝和迁移替换通过共享纯函数测试覆盖。
