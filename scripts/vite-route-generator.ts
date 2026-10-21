import path from 'node:path'
import { normalizePath, type Plugin } from 'vite'

/** Keep generated output out of the generator's inputs, without suppressing Vite HMR. */
export function routeGeneratorWatchGuard(generatedRouteTree: string): Plugin {
    return {
        name: 'coeer:route-generator-watch-guard',
        apply: 'serve',
        configResolved(config) {
            const generator = config.plugins.find((plugin) => plugin.name === 'tanstack:router-generator')
            const hook = generator?.watchChange
            if (!generator || !hook) throw new Error('TanStack route generator watch hook was not found')
            const original = typeof hook === 'function' ? hook : hook.handler
            const canonical = (value: string) => {
                const absolute = normalizePath(path.resolve(config.root, value))
                return process.platform === 'win32' ? absolute.toLowerCase() : absolute
            }
            const output = canonical(generatedRouteTree)
            const guarded: typeof original = function (id, change) {
                // Two dev servers/builds can otherwise treat each other's identical output
                // as an edit and keep force-writing it forever. Route source edits still
                // reach the generator; Vite still watches the output and updates modules.
                if (change.event !== 'delete' && canonical(id) === output) return
                return original.call(this, id, change)
            }
            generator.watchChange = typeof hook === 'function' ? guarded : { ...hook, handler: guarded }
        },
    }
}
