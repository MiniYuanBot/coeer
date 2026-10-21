import 'dotenv/config'
import { spaceEnvironment } from '../src/server/open-space/environment'

const [command, ...args] = process.argv.slice(2)
if (!['ops', 'connector', 'official'].includes(command)) throw new Error('Expected ops, connector or official')
const values = spaceEnvironment(process.env)
// The upstream CLIs consume unprefixed variables. Replace only their configuration
// inside this CLI process; the running COEER process and .env remain untouched.
for (const name of Object.keys(process.env)) {
  if (/^(OFFICIAL_|CONNECTOR_|DATABASE_PATH$|CONFIG_ENV_FILE$|APP_ENV$|APP_ORIGIN$|ADAPTER_MODE$|DEMO_MODE$|SYNC_ENABLED$|BOOKING_ENABLED$|PUBLIC_BOOKING_USER_ID$|ADMIN_)/.test(name)) delete process.env[name]
}
for (const [name, value] of Object.entries(values)) {
  if (value !== undefined) process.env[name] = value
}
process.argv = [process.argv[0], process.argv[1], ...args]
if (command === 'ops') await import('../src/server/open-space/ops-cli')
else if (command === 'connector') await import('../src/server/open-space/connector-index')
else await import('../src/server/open-space/connector-cli')
