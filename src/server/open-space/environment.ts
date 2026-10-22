/** Refuse retired configuration names rather than silently running with defaults. */
export function assertBookingEnvironment(source: NodeJS.ProcessEnv = process.env) {
  const retired = Object.keys(source).filter(name => name.startsWith('OPENSPACE_') && source[name] !== undefined)
  if (retired.length) throw new Error(`Retired booking variables: ${retired.join(', ')}. Use BOOKING_*, CAMPUS_* and CONNECTOR_* names from .env.example.`)
}

/** Isolate reservation settings from the main application, using one naming scheme everywhere. */
export function spaceEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  assertBookingEnvironment(source)
  const values: NodeJS.ProcessEnv = { NODE_ENV: source.NODE_ENV }
  for (const [name, value] of Object.entries(source)) {
    if (/^(BOOKING_|CAMPUS_|CONNECTOR_)/.test(name)) values[name] = value
  }
  values.BOOKING_ALLOWED_ORIGIN ??= source.CLIENT_URL ?? 'http://localhost:3000'
  values.DATABASE_URL = source.DATABASE_URL
  values.BOOKING_DB_SCHEMA ??= 'coeer_spaces'
  values.BOOKING_DATA_SOURCE ??= 'official'
  return values
}
