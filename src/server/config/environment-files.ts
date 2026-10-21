import { config } from 'dotenv'

/** Match Vite's precedence for server runtime and operational commands. */
export function loadEnvironmentFiles(mode = process.env.NODE_ENV || 'development') {
    config({ path: [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'], quiet: true })
}
