import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { initializeProductionSpaceBackground } from './server/startup'
import { env } from './server/config'
import { withRequestLimit } from './server/utils/request-limit'

initializeProductionSpaceBackground(import.meta.env.PROD)

export default { fetch: withRequestLimit(createStartHandler(defaultStreamHandler), env.HTTP_MAX_CONCURRENCY) }
