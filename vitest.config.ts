import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
    resolve: {
        alias: {
            '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
            '@': fileURLToPath(new URL('./src/app', import.meta.url)),
            '~': fileURLToPath(new URL('./src/server', import.meta.url)),
        },
    },
    test: {
        include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
        testTimeout: 15000,
        hookTimeout: 30000,
        fileParallelism: false,
    },
})
