import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { gzipSync } from 'node:zlib'
import type { Plugin } from 'vite'

/** Opt-in local report; never emits source paths into the public build. */
export function buildReport(): Plugin {
    return {
        name: 'coeer-build-report', apply: 'build',
        writeBundle(_options, bundle) {
            if (this.environment.name !== 'client') return
            const report = Object.values(bundle).map(item => {
                const data = item.type === 'chunk' ? item.code : item.source
                const bytes = Buffer.from(data)
                return { name: item.fileName, bytes: bytes.length, gzip: gzipSync(bytes).length,
                    ...(item.type === 'chunk' ? {
                        entry: item.isEntry, imports: item.imports, dynamicImports: item.dynamicImports,
                        modules: Object.entries(item.modules).map(([name, module]) => ({
                            name: name.replace(process.cwd().replaceAll('\\', '/'), '.'), bytes: module.renderedLength,
                        })).sort((a, b) => b.bytes - a.bytes).slice(0, 25),
                    } : {}),
                }
            }).sort((a, b) => b.bytes - a.bytes)
            const output = 'tmp/performance/bundle.json'
            mkdirSync(dirname(output), { recursive: true })
            writeFileSync(output, JSON.stringify(report, null, 2))
        },
    }
}
