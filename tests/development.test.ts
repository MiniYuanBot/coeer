import { describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import type { Plugin } from 'vite'
import { routeGeneratorWatchGuard } from '../scripts/vite-route-generator'

async function install(generator: Plugin) {
    const guard = routeGeneratorWatchGuard('src/app/routeTree.gen.ts')
    const hook = guard.configResolved!
    const handler = typeof hook === 'function' ? hook : hook.handler
    await Reflect.apply(handler, {}, [{ root: process.cwd(), plugins: [generator] }])
    const watch = generator.watchChange!
    return typeof watch === 'function' ? watch : watch.handler
}

describe('development route generation', () => {
    it('ignores generated output updates while forwarding route edits and output deletion', async () => {
        const original = vi.fn()
        const generator: Plugin = { name: 'tanstack:router-generator', watchChange: original }
        const watch = await install(generator)
        const context = { fixture: true }
        const output = path.resolve('src/app/routeTree.gen.ts')
        await Reflect.apply(watch, context, [output, { event: 'update' }])
        await Reflect.apply(watch, context, [output, { event: 'create' }])
        expect(original).not.toHaveBeenCalled()
        const source = path.resolve('src/app/routes/_authed/spaces/index.tsx')
        await Reflect.apply(watch, context, [source, { event: 'update' }])
        await Reflect.apply(watch, context, [output, { event: 'delete' }])
        expect(original.mock.calls).toEqual([[source, { event: 'update' }], [output, { event: 'delete' }]])
        expect(original.mock.contexts).toEqual([context, context])
    })

    it('preserves ordered hook metadata and async completion', async () => {
        let completed = false
        const original = vi.fn(async () => { await Promise.resolve(); completed = true })
        const generator: Plugin = { name: 'tanstack:router-generator', watchChange: { order: 'pre', handler: original } }
        const watch = await install(generator)
        expect(generator.watchChange).toMatchObject({ order: 'pre' })
        await Reflect.apply(watch, {}, [path.resolve('src/app/routes/signup.tsx'), { event: 'update' }])
        expect(completed).toBe(true)
    })

    it('fails clearly if an upstream plugin upgrade changes the generator hook', async () => {
        await expect(install({ name: 'another-plugin' })).rejects.toThrow('TanStack route generator watch hook was not found')
    })
})
