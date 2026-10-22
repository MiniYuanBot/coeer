import { loadEnvironmentFiles } from '../src/server/config/environment-files'
import { spaceEnvironment } from '../src/server/open-space/environment'

loadEnvironmentFiles()
for (const [name, value] of Object.entries(spaceEnvironment(process.env))) {
  if (value !== undefined) process.env[name] = value
}
const [command, ...args] = process.argv.slice(2)
if (!['ops', 'connector', 'official'].includes(command)) throw new Error('Expected ops, connector or official')
process.argv = [process.argv[0], process.argv[1], ...args]
if (command === 'ops') await import('../src/server/open-space/ops-cli')
else if (command === 'connector') await import('../src/server/open-space/connector-index')
else await import('../src/server/open-space/connector-cli')
