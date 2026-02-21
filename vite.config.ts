import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig, loadEnv } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  if (mode === 'development') {
    console.log('✅ Env variables load successfully')
  }
  
  return {
    server: {
      port: parseInt(env.PORT) || 3000,
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tanstackStart({
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