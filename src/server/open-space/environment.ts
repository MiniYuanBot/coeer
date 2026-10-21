/** Share COEER's PostgreSQL connection; keep other booking settings namespaced. */
export function spaceEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const values: NodeJS.ProcessEnv = { NODE_ENV: source.NODE_ENV }
  for (const [name, value] of Object.entries(source)) {
    if (name.startsWith('OPENSPACE_')) values[name.slice(10)] = value
  }
  values.APP_ORIGIN ??= source.CLIENT_URL ?? 'http://localhost:3000'
  values.DATABASE_URL ??= source.DATABASE_URL
  values.DATABASE_SCHEMA ??= 'coeer_spaces'
  // Development and deployment use the same official service. Synthetic adapters
  // are selected explicitly by isolated tests, never as a configuration fallback.
  values.ADAPTER_MODE ??= 'official'
  return values
}
