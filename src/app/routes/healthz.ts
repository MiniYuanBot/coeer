import { createFileRoute } from '@tanstack/react-router'
import { readinessResponse } from '~/utils/health'

export const Route = createFileRoute('/healthz')({
  server: {
    handlers: { GET: () => readinessResponse() },
  },
})
