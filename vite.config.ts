import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig, loadEnv } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { routeGeneratorWatchGuard } from './scripts/vite-route-generator'
import { spacesStartupPlugin } from './scripts/vite-spaces-startup'
import { buildReport } from './scripts/vite-build-report'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  if (mode === 'development') {
    console.log('Env variables load successfully')
  }
  
  return {
    environments: {
      client: {
        build: {
          rollupOptions: {
            output: {
              manualChunks(id) {
                if (!id.includes('/node_modules/')) return
                if (/\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
                if (id.includes('/zod/')) return 'vendor-validation'
              },
            },
          },
        },
      },
    },
    server: {
      port: parseInt(env.PORT) || 3000,
      strictPort: true,
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.coeer-local/**'] },
      watch: {
        // Router-generator scratch writes and local QA artifacts must not retrigger HMR.
        ignored: ['**/.tanstack/**', '**/tmp/**', '**/.coeer-local/**'],
      },
    },
    optimizeDeps: {
      // The campus login browser runs only inside server-side reservation code.
      exclude: ['playwright-core'],
    },
    plugins: [
      ...(process.env.COEER_BUILD_REPORT === '1' ? [buildReport()] : []),
      routeGeneratorWatchGuard(path.resolve(__dirname, 'src/app/routeTree.gen.ts')),
      spacesStartupPlugin(),
      tailwindcss(),
      tsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tanstackStart({
        server: { entry: './server.ts' },
        router: {
          entry: './app/router.tsx',
          routesDirectory: './app/routes',
          generatedRouteTree: './app/routeTree.gen.ts',
        }
      }),
      viteReact(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src/app'),
        '~': path.resolve(__dirname, './src/server'),
        '@shared': path.resolve(__dirname, './src/shared'),
      },
    },
  }
})
