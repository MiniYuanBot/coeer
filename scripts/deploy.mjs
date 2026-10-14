import { createHash, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sshOptions = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3']
const sourceEntries = ['src', 'public', 'scripts', 'deploy', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'vite.config.ts']

export function validateConfig(config) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(config.host || '')) throw new Error('host 必须是 SSH 配置中的别名。')
  if (!/^\/[A-Za-z0-9_./-]+$/.test(config.root || '') || config.root.split('/').some((part) => part === '.' || part === '..') || config.root.split('/').filter(Boolean).length < 3) throw new Error('root 必须是具体项目的绝对路径。')
  if (!/^[A-Za-z0-9_-]+\.service$/.test(config.service || '')) throw new Error('service 必须是 systemd 服务名。')
  if (!/^\/[A-Za-z0-9_./-]+$/.test(config.pnpm || '') || config.pnpm.split('/').includes('..')) throw new Error('pnpm 必须是远程可执行文件的绝对路径。')
  if (!/^\d+\.\d+\.\d+$/.test(config.pnpmVersion || '')) throw new Error('必须固定 pnpmVersion。')
  for (const key of ['port', 'previewPort']) {
    if (!Number.isInteger(config[key]) || config[key] < 1024 || config[key] > 65535) throw new Error(key + ' 必须是 1024–65535 的整数。')
  }
  if (config.port === config.previewPort) throw new Error('预检端口必须与线上端口不同。')
  return config
}

export function parseArgs(args) {
  const options = { action: 'deploy', dryRun: false }
  let actionSet = false
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') return { help: true }
    if (arg === '--dry-run') { options.dryRun = true; continue }
    if (arg === '--config') {
      if (!args[++index] || args[index].startsWith('--')) throw new Error('--config 缺少文件路径。')
      options.config = args[index]
      continue
    }
    if (['--check', '--prepare', '--rollback', '--activate'].includes(arg)) {
      if (actionSet) throw new Error('只能指定一个发布动作。')
      options.action = arg.slice(2)
      actionSet = true
      if (arg === '--activate') {
        options.release = args[++index]
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]{5,100}$/.test(options.release || '')) throw new Error('--activate 缺少有效的版本 ID。')
      }
      continue
    }
    throw new Error('未知参数：' + arg)
  }
  return options
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: project, stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(command + ' 执行失败（退出码 ' + (result.status ?? result.signal) + '）。')
  return result.stdout
}

export function createArchive(projectPath, destination) {
  for (const name of ['src', 'public', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'vite.config.ts']) {
    if (!existsSync(join(projectPath, name))) throw new Error('缺少发布文件：' + name)
  }
  const excludes = ['.env*', '*.local.json', '*.pem', '*.key', '.git', '.ssh', '.aws', 'node_modules', '__pycache__']
  const args = [...excludes.map((item) => '--exclude=' + item), '-czf', destination, '-C', projectPath, ...sourceEntries.filter((name) => existsSync(join(projectPath, name)))]
  // Archive the working tree, including the current uncommitted UI changes.
  run('tar', args, { env: { ...process.env, COPYFILE_DISABLE: '1' } })
  return createHash('sha256').update(readFileSync(destination)).digest('hex')
}

function quote(value) { return "'" + String(value).replaceAll("'", "'\\''") + "'" }
function remoteArgs(config, options) {
  const args = [options.action, '--root', config.root, '--service', config.service, '--pnpm', config.pnpm, '--pnpm-version', config.pnpmVersion, '--port', String(config.port), '--preview-port', String(config.previewPort)]
  if (options.release) args.push('--release', options.release)
  if (options.archive) args.push('--archive', options.archive, '--sha256', options.sha256)
  return args
}

function remote(config, args) {
  const script = readFileSync(join(project, 'deploy', 'remote.py'), 'utf8')
  run('ssh', [...sshOptions, config.host, ['sudo', '-n', 'python3', '-', ...args].map(quote).join(' ')], { input: script, stdio: ['pipe', 'inherit', 'inherit'] })
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log('npm run deploy                     发布当前本地代码\nnpm run deploy:check               只读检查服务器\nnpm run deploy -- --dry-run         查看计划，不连接服务器\nnpm run deploy -- --prepare         构建并预检，不切换线上\nnpm run deploy -- --activate <ID>   发布已预检版本\nnpm run deploy:rollback            回滚到上一版本\n可选：--config <JSON 文件>')
    return
  }
  const defaultFile = join(project, 'deploy', 'aliyun.json')
  const overrideFile = options.config ? resolve(options.config) : join(project, 'deploy', 'aliyun.local.json')
  const config = validateConfig({ ...JSON.parse(readFileSync(defaultFile, 'utf8')), ...(existsSync(overrideFile) ? JSON.parse(readFileSync(overrideFile, 'utf8')) : {}) })
  if (options.config && !existsSync(overrideFile)) throw new Error('配置文件不存在：' + overrideFile)
  console.log('目标：' + config.host + '  ' + config.root + '  ' + config.service)
  if (options.dryRun) {
    console.log('动作：' + options.action + '；线上端口 ' + config.port + '；隔离预检端口 ' + config.previewPort)
    console.log('上传范围：' + sourceEntries.join(', '))
    console.log('排除本地 .env、密钥、依赖、构建产物和本机配置；不执行数据库迁移。')
    console.log('dry-run：不连接服务器、不上传、不重启。')
    return
  }
  if (['check', 'rollback', 'activate'].includes(options.action)) {
    remote(config, remoteArgs(config, options))
    return
  }
  console.log('检查本地 TypeScript…')
  const tsc = join(project, 'node_modules', 'typescript', 'bin', 'tsc')
  if (!existsSync(tsc)) throw new Error('请先安装项目依赖，再执行发布。')
  run(process.execPath, [tsc, '--noEmit'])
  remote(config, remoteArgs(config, { action: 'check' }))

  const temporary = mkdtempSync(join(tmpdir(), 'coeer-deploy-'))
  const release = new Date().toISOString().replace(/[-:.TZ]/g, '') + '-' + randomBytes(5).toString('hex')
  const upload = '/tmp/coeer-deploy-' + release
  let uploaded = false
  try {
    const archive = join(temporary, 'source.tar.gz')
    const sha256 = createArchive(project, archive)
    run('ssh', [...sshOptions, config.host, ['mkdir', '-m', '700', '--', upload].map(quote).join(' ')])
    uploaded = true
    console.log('上传版本 ' + release + '…')
    run('scp', [...sshOptions, '-q', archive, config.host + ':' + upload + '/source.tar.gz'])
    remote(config, remoteArgs(config, { ...options, release, archive: upload + '/source.tar.gz', sha256 }))
  } finally {
    rmSync(temporary, { recursive: true, force: true })
    if (uploaded) {
      // Only remove this command's random, private upload directory.
      const cleanup = "import pathlib,shutil,sys; p=pathlib.Path(sys.argv[1]); shutil.rmtree(p) if p.parent==pathlib.Path('/tmp') and p.name.startswith('coeer-deploy-') and not p.is_symlink() else None"
      const result = spawnSync('ssh', [...sshOptions, config.host, ['python3', '-c', cleanup, upload].map(quote).join(' ')], { stdio: 'ignore' })
      if (result.status !== 0) console.warn('临时上传目录未清理：' + upload)
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (error) { console.error('发布未完成：' + error.message); process.exitCode = 1 }
}
