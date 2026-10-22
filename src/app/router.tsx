import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary, NotFound } from './components/basic'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function getRouter() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15000, retry: 1 } } })
  const router = createRouter({
    Wrap: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    routeTree,
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    scrollRestoration: true,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
