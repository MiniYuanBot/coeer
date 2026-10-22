import { runConfiguredOperation } from '../deploy/database.mjs'
import { promptAdministrator } from './admin-input.mjs'

const [action, ...args] = process.argv.slice(2)
try {
  if (!['clear', 'setup'].includes(action) || args.some(arg => !['--execute', '--dry-run'].includes(arg))
      || (action === 'setup' && args.includes('--execute')) || new Set(args).size !== args.length) {
    throw new Error('用法：pnpm db:clear [--execute] [--dry-run] 或 pnpm db:setup [--dry-run]。')
  }
  if (args.includes('--dry-run')) {
    console.log(action === 'clear' ? 'dry-run：清空本地配置指向的社区和预约数据，不备份；未连接数据库。' : 'dry-run：在交互终端输入管理员邮箱、昵称和密码，仅创建一个管理员；未连接数据库。')
  } else {
    const request = { action: 'db-' + action, execute: args.includes('--execute') }
    if (action === 'setup') request.admin = await promptAdministrator()
    console.log(JSON.stringify(await runConfiguredOperation(request), null, 2))
  }
} catch (error) {
  console.error(error.code ? '数据库操作失败，错误代码：' + error.code : error.message)
  process.exitCode = 1
}
