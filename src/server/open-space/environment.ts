/** Isolate booking configuration from the host application's PostgreSQL/session settings. */
export function spaceEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const values: NodeJS.ProcessEnv = { NODE_ENV: source.NODE_ENV }
  for (const [name, value] of Object.entries(source)) {
    if (name.startsWith('OPENSPACE_')) values[name.slice(10)] = value
  }
  values.APP_ORIGIN ??= source.CLIENT_URL ?? 'http://localhost:3000'
  values.DATABASE_PATH ??= 'data/openspace.sqlite'
  values.ADAPTER_MODE ??= source.NODE_ENV === 'production' ? 'official-disabled' : 'mock'
  return values
}
