// Package only the reviewed migration tools; never upload local .env or change the live application.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { validateConfig } from './deploy.mjs'

const config = validateConfig(JSON.parse(readFileSync('deploy/aliyun.json', 'utf8')))
const [action = 'scan', artifact] = process.argv.slice(2)
if (!['scan', 'verify', 'apply', 'rollback'].includes(action) || (['apply', 'rollback'].includes(action) && !artifact)) {
    throw new Error('用法：node scripts/unicode-remote.mjs scan|verify|apply <远程扫描路径>|rollback <远程manifest路径>')
}
const files = ['scripts/unicode-data.ts', 'src/server/database/unicode-migration.ts', 'src/server/config/environment-files.ts',
    'src/shared/unicode.ts', 'src/shared/username-policy.mjs', 'deploy/database.mjs', 'deploy/migrations/20261026-unicode-usernames.sql']
const root = resolve('.coeer-local/unicode-tools')
mkdirSync(root, { recursive: true })
const directory = mkdtempSync(join(root, 'bundle-'))
const names = files.map(file => file.replace(/\.ts$/, '.mjs'))
for (const [index, file] of files.entries()) {
    let source = readFileSync(file, 'utf8')
    if (file.endsWith('.ts')) {
        source = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
        source = source.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (all, prefix, path, suffix) =>
            /\.(mjs|js|sql)$/.test(path) ? all : `${prefix}${path}.mjs${suffix}`)
    }
    const output = join(directory, names[index])
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, source)
}
const archive = join(directory, 'tools.tar.gz')
function run(command, args, options = {}) {
    const result = spawnSync(command, args, { stdio: 'inherit', ...options })
    if (result.error || result.status !== 0) throw new Error(`${command} failed (${result.status})`)
    return result.stdout
}
run('tar', ['-czf', archive, '-C', directory, ...names])
const payload = readFileSync(archive)
const request = { config, action, artifact, archive: payload.toString('base64'), sha256: createHash('sha256').update(payload).digest('hex') }
const python = `import os, sys, json, base64, hashlib, io, tarfile, subprocess, pathlib, fcntl
req=json.loads(base64.b64decode('${Buffer.from(JSON.stringify(request)).toString('base64')}'))
cfg=req['config']
root=pathlib.Path(cfg['root']).resolve()
control=root/'.deploy'
control.mkdir(mode=0o700,exist_ok=True)
with open(control/'lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 working=subprocess.check_output(['systemctl','show',cfg['service'],'--property=WorkingDirectory','--value'],text=True).strip()
 if working not in (str(root),str(control/'current')): raise RuntimeError('Unexpected live service directory')
 release=pathlib.Path(working).resolve()
 if release!=root and (control/'releases').resolve() not in release.parents: raise RuntimeError('Unexpected release target')
 subprocess.run(['systemctl','is-active','--quiet',cfg['service']],check=True)
 data=base64.b64decode(req['archive'])
 if hashlib.sha256(data).hexdigest()!=req['sha256']: raise RuntimeError('Archive checksum mismatch')
 destination=control/'unicode-tools'/req['sha256']
 destination.mkdir(parents=True,mode=0o700,exist_ok=True)
 with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
  for item in archive.getmembers():
   target=(destination/item.name).resolve()
   if destination.resolve() not in target.parents or not item.isfile(): raise RuntimeError('Unsafe archive entry')
   target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
   target.write_bytes(archive.extractfile(item).read())
 dependencies=destination/'node_modules'
 if not dependencies.exists(): dependencies.symlink_to(release/'node_modules',target_is_directory=True)
 environment={**os.environ,'NODE_ENV':'production','COEER_UNICODE_DIR':str(control/'unicode-data'),'PATH':str(pathlib.Path(cfg['pnpm']).parent)+':'+os.environ.get('PATH','')}
 args=[str(pathlib.Path(cfg['pnpm']).parent/'node'),str(destination/'scripts/unicode-data.mjs'),req['action']]
 if req.get('artifact'): args.extend(['--report' if req['action']=='apply' else '--manifest',req['artifact']])
 subprocess.run(args,cwd=release,env=environment,check=True)
`
run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', config.host, 'sudo -n python3 -'], { input: python, stdio: ['pipe', 'inherit', 'inherit'] })
