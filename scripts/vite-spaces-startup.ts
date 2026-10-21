import path from 'node:path'
import { isRunnableDevEnvironment, normalizePath, type Plugin, type ViteDevServer } from 'vite'

type StartupModule = typeof import('../src/server/startup')

/** Start the background runtime when the dev server listens, before any page request. */
export function spacesStartupPlugin(): Plugin {
    let close = async () => {}
    return {
        name: 'coeer:spaces-background-startup',
        apply: 'serve',
        configureServer(server: ViteDevServer) {
            let started: Promise<StartupModule | undefined> | undefined
            let closing: Promise<void> | undefined
            let startupModule: StartupModule | undefined
            let closed = false
            const begin = () => {
                if (started || closed || process.env.TSS_PRERENDERING === 'true') return
                started = (async () => {
                    const environment = server.environments.ssr
                    if (!isRunnableDevEnvironment(environment)) throw new Error('SSR runtime unavailable')
                    const startup = await environment.runner.import<StartupModule>(normalizePath(path.resolve(server.config.root, 'src/server/startup.ts')))
                    startupModule = startup
                    if (!closed) await startup.startSpaceBackground()
                    return startup
                })().catch(() => {
                    console.error(JSON.stringify({ event: 'spaces.runtime.dev_start_failed' }))
                    return startupModule
                })
            }
            close = () => closing ??= (async () => {
                closed = true
                server.httpServer?.off('listening', begin)
                const startup = await started
                await startup?.stopSpaceBackground()
            })()
            server.httpServer?.once('listening', begin)
            server.httpServer?.once('close', () => {
                void close().catch(() => console.error(JSON.stringify({ event: 'spaces.runtime.dev_stop_failed' })))
            })
            if (server.httpServer?.listening) begin()
        },
        async closeBundle() { await close() },
    }
}
