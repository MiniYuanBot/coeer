/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import * as React from 'react'
import { DefaultCatchBoundary, NotFound } from '@/components/basic'
import { PageStatus, ToastProvider } from '@/components/coeer'
import appCss from '@/styles/app.css?url'
import { fetchUserFn } from '~/functions'
import { seo } from '~/utils/seo.js'

/** 在首帧前设置明暗主题，避免深色模式用户看到闪烁的浅色页面。 */
const THEME_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem('coeer-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();`

export const Route = createRootRoute({
  // 根上下文：会话用户。所有路由（含公共页）都能拿到，登录态守卫由
  // `_authed` 等布局路由负责（前端守卫只做 UX，服务端 Service 才是边界）。
  beforeLoad: async () => {
    const user = await fetchUserFn()
    return { user }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ...seo({
        title: 'COEER | 学院社区与成长激励系统',
        description: 'COEER 是学院/组织内部社区与成长激励系统。',
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
      },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
    scripts: [{ children: THEME_SCRIPT }],
  }),
  component: RootLayout,
  errorComponent: (props) => (
    <RootDocument>
      <DefaultCatchBoundary {...props} />
    </RootDocument>
  ),
  notFoundComponent: () => <NotFound />,
})

function RootLayout() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

/** 全局文档骨架：head（路由 head 内容）+ Toast/路由进度条 + 页面出口。 */
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        <ToastProvider>
          <PageStatus />
          {children}
        </ToastProvider>
        {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
        <Scripts />
      </body>
    </html>
  )
}
