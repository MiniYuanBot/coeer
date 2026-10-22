import { loadEnvironmentFiles } from './config/environment-files'
import { assertBookingEnvironment } from './open-space/environment'
import { startEmbeddedSpaceServer, stopEmbeddedSpaceServer } from './open-space/embedded'

export async function startSpaceBackground() {
    loadEnvironmentFiles()
    assertBookingEnvironment()
    if (process.env.BOOKING_ENGINE_URL) return
    await startEmbeddedSpaceServer()
}

export const stopSpaceBackground = () => stopEmbeddedSpaceServer()

/** The build only transforms this entry; prerendering explicitly skips background work. */
export function initializeProductionSpaceBackground(production: boolean, prerendering = process.env.TSS_PRERENDERING === 'true') {
    if (!production || prerendering) return () => {}
    void startSpaceBackground().catch(() => { /* The runtime logs its sanitized startup failure once. */ })
    const close = () => {
        void stopSpaceBackground().catch(() => console.error(JSON.stringify({ event: 'spaces.runtime.stop_failed' })))
    }
    process.once('SIGINT', close)
    process.once('SIGTERM', close)
    process.once('beforeExit', close)
    return () => {
        process.off('SIGINT', close)
        process.off('SIGTERM', close)
        process.off('beforeExit', close)
    }
}
