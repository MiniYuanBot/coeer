import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig, loadEnv } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { routeGeneratorWatchGuard } from './scripts/vite-route-generator'
import { spacesStartupPlugin } from './scripts/vite-spaces-startup'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  if (mode === 'development') {
    console.log('Env variables load successfully')
  }
  
  return {
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
