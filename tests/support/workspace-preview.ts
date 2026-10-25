import { fileURLToPath } from 'node:url'
import { realpathSync } from 'node:fs'
import type { InlineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export function workspacePreviewConfig(port = 0): InlineConfig {
    const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))
    return {
        configFile: false, cacheDir: port ? 'tmp/vite-workspace-preview' : 'tmp/vite-workspace-tests', plugins: [tailwindcss()],
        resolve: { alias: [
            { find: /^~\/functions(?:\/.*)?$/, replacement: fixture('workspace-actions.ts') },
            { find: /^@\/hooks\/useSpaces$/, replacement: fixture('workspace-spaces.tsx') },
            { find: /^\.\/useSpaces$/, replacement: fixture('workspace-spaces.tsx') },
            { find: '@tanstack/react-router', replacement: fixture('workspace-router.tsx') },
            { find: '@', replacement: fileURLToPath(new URL('../../src/app', import.meta.url)) },
            { find: '@shared', replacement: fileURLToPath(new URL('../../src/shared', import.meta.url)) },
        ] },
        server: { host: '127.0.0.1', port, strictPort: port > 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')], deny: ['.env', '.env.*', '**/.git/**', '**/.coeer-local/**'] } },
        optimizeDeps: { entries: ['tests/fixtures/workspace.html'], include: ['react-dom', '@tanstack/react-query'] },
    }
}
