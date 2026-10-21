import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeLifecycle } from '../src/server/open-space/runtime-lifecycle'

const background = vi.hoisted(() => ({ start: vi.fn(async () => undefined), stop: vi.fn(async () => undefined), load: vi.fn() }))
vi.mock('../src/server/open-space/embedded', () => ({ startEmbeddedSpaceServer: background.start, stopEmbeddedSpaceServer: background.stop }))
vi.mock('../src/server/config/environment-files', () => ({ loadEnvironmentFiles: background.load }))
vi.mock('vite', async (actual) => ({ ...await actual<object>(), isRunnableDevEnvironment: () => true }))

import { spacesStartupPlugin } from '../scripts/vite-spaces-startup'
import { initializeProductionSpaceBackground, startSpaceBackground } from '../src/server/startup'

const runHook = (hook: unknown, args: unknown[] = []) => {
    const handler = typeof hook === 'function' ? hook : (hook as { handler: (...values: unknown[]) => unknown }).handler
    return Reflect.apply(handler, {}, args)
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('TSS_PRERENDERING', 'false')
    vi.stubEnv('OPENSPACE_BACKEND_URL', '')
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('explicit reservation runtime lifecycle', () => {
    it('does not start on reads and shares exactly one explicit startup and shutdown', async () => {
        const close = vi.fn(async () => {})
        const factory = vi.fn(async () => ({ url: 'http://127.0.0.1:1234', close }))
        const runtime = createRuntimeLifecycle(factory, vi.fn())
        await expect(runtime.get()).rejects.toThrow('has not started')
        expect(factory).not.toHaveBeenCalled()
        const first = runtime.start()
        expect(runtime.start()).toBe(first)
        expect(runtime.get()).toBe(first)
        const active = await first
        await Promise.all([active.close(), runtime.stop()])
        expect(factory).toHaveBeenCalledOnce()
        expect(close).toHaveBeenCalledOnce()
        await expect(runtime.get()).rejects.toThrow('has not started')
    })

    it('retains a failed startup and never retries it for subsequent reads', async () => {
        const failure = new Error('invalid private configuration')
        const factory = vi.fn(async () => { throw failure })
        const report = vi.fn()
        const runtime = createRuntimeLifecycle(factory, report)
        const failed = runtime.start()
        await expect(failed).rejects.toBe(failure)
        expect(runtime.start()).toBe(failed)
        await expect(runtime.get()).rejects.toBe(failure)
        await expect(runtime.get()).rejects.toBe(failure)
        expect(factory).toHaveBeenCalledOnce()
        expect(report).toHaveBeenCalledExactlyOnceWith(failure)
        await runtime.stop()
    })

    it('waits for an in-flight startup before closing and refuses reads during shutdown', async () => {
        let release!: (value: { url: string; close: () => Promise<void> }) => void
        const pending = new Promise<{ url: string; close: () => Promise<void> }>(resolve => { release = resolve })
        const close = vi.fn(async () => {})
        const runtime = createRuntimeLifecycle(() => pending, vi.fn())
        void runtime.start()
        const stopping = runtime.stop()
        await expect(runtime.get()).rejects.toThrow('has not started')
        release({ url: 'http://127.0.0.1:1234', close })
        await stopping
        expect(close).toHaveBeenCalledOnce()
    })
})

describe('development server startup', () => {
    function setup(start = vi.fn(async () => {})) {
        const plugin = spacesStartupPlugin()
        const httpServer = Object.assign(new EventEmitter(), { listening: false })
        const stop = vi.fn(async () => {})
        const load = vi.fn(async () => ({ startSpaceBackground: start, stopSpaceBackground: stop }))
        const server = { httpServer, config: { root: process.cwd() }, environments: { ssr: { runner: { import: load } } } }
        runHook(plugin.configureServer, [server])
        return { plugin, httpServer, start, stop, load }
    }

    it('starts without a page request after listening and closes once on server shutdown', async () => {
        const { plugin, httpServer, start, stop, load } = setup()
        expect(load).not.toHaveBeenCalled()
        httpServer.emit('listening')
        await vi.waitFor(() => expect(start).toHaveBeenCalledOnce())
        httpServer.emit('listening')
        expect(load).toHaveBeenCalledOnce()
        expect(stop).not.toHaveBeenCalled()
        httpServer.emit('close')
        await runHook(plugin.closeBundle)
        expect(stop).toHaveBeenCalledOnce()
    })

    it('logs startup failure without retrying on later events, and still performs cleanup', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        const start = vi.fn(async () => { throw new Error('private password must not be logged') })
        const { plugin, httpServer, stop } = setup(start)
        httpServer.emit('listening')
        await vi.waitFor(() => expect(log).toHaveBeenCalled())
        httpServer.emit('listening')
        expect(start).toHaveBeenCalledOnce()
        expect(log.mock.calls.flat().join(' ')).not.toContain('private password')
        await runHook(plugin.closeBundle)
        expect(stop).toHaveBeenCalledOnce()
    })
})

describe('production startup boundary', () => {
    it('does not start for development entry imports, static prerendering, or an external engine', async () => {
        initializeProductionSpaceBackground(false, false)()
        initializeProductionSpaceBackground(true, true)()
        expect(background.start).not.toHaveBeenCalled()
        vi.stubEnv('OPENSPACE_BACKEND_URL', 'https://engine.invalid')
        await startSpaceBackground()
        expect(background.start).not.toHaveBeenCalled()
    })

    it('starts on production entry import and installs shutdown callbacks without waiting for a request', async () => {
        const callbacks = new Map<string, () => void>()
        const once = vi.spyOn(process, 'once').mockImplementation(((event: string, callback: () => void) => { callbacks.set(event, callback); return process }) as typeof process.once)
        const dispose = initializeProductionSpaceBackground(true, false)
        once.mockRestore()
        await vi.waitFor(() => expect(background.start).toHaveBeenCalledOnce())
        expect(callbacks.has('SIGTERM')).toBe(true)
        callbacks.get('SIGTERM')!()
        await vi.waitFor(() => expect(background.stop).toHaveBeenCalledOnce())
        dispose()
    })
})
