import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { initializeProductionSpaceBackground } from './server/startup'

initializeProductionSpaceBackground(import.meta.env.PROD)

export default { fetch: createStartHandler(defaultStreamHandler) }
