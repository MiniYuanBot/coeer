/** Local campus-network checks. Credentials and sessions stay in the gitignored .coeer-local directory. */
import { loadEnvironmentFiles } from '../src/server/config/environment-files'
import { assertBookingEnvironment } from '../src/server/open-space/environment'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { loadOfficialConfig } from '../src/server/open-space/adapters/official/config'
import { loadAccountCredentials, loginAuthorizedAccount } from '../src/server/open-space/adapters/official/recovery'
import { ManagedSession, saveSession } from '../src/server/open-space/adapters/official/session'
import { OfficialHTTP } from '../src/server/open-space/adapters/official/http'
import { LiveOfficialAdapter } from '../src/server/open-space/adapters/official/live'
import { AdapterError } from '../src/server/open-space/adapters/adapter'
import { addDays, today, validDate } from '../src/shared/open-space/domain'

loadEnvironmentFiles()
assertBookingEnvironment()

const directory = resolve(process.env.BOOKING_PRIVATE_DIR || './.coeer-local')
const configFile = resolve(process.env.CAMPUS_API_CONFIG_FILE || resolve(directory, 'official.json'))
const sessionFile = resolve(process.env.CAMPUS_COOKIE_FILE || resolve(directory, 'session.enc.json'))
const sessionKeyFile = resolve(process.env.CAMPUS_COOKIE_KEY_FILE || resolve(directory, 'session-key.json'))
const command = process.argv[2] || 'probe'

async function main() {
    if (!['login', 'probe'].includes(command)) throw new Error('Use login or probe [YYYY-MM-DD]')
    const config = loadOfficialConfig(configFile)
    if (config.baseURL !== 'http://smart.coe.pku.edu.cn:9091/meeting/' || !config.allowHTTP)
        throw new Error('Expected the campus meeting endpoint')
    if (command === 'login') {
        // The current user explicitly supplied this campus test account. Use one
        // normal login attempt in a new browser context without a proxy.
        const credentials = loadAccountCredentials(process.env.CAMPUS_ACCOUNT_FILE || resolve(directory, 'account.enc.json'),
            process.env.CAMPUS_ACCOUNT_KEY_FILE || resolve(directory, 'account-key.json'), config.account.alias)
        const session = await loginAuthorizedAccount(config, credentials)
        saveSession(sessionFile, sessionKeyFile, session)
        console.log(JSON.stringify({ event: 'campus.login', authenticated: true, proxy: false }))
    }
    const date = process.argv[3] || addDays(today(), 1)
    if (!validDate(date)) throw new Error('Expected YYYY-MM-DD')
    const transport = new OfficialHTTP(config, new ManagedSession(config, sessionFile, sessionKeyFile).provider)
    // This command only reads. Bindings are never persisted or written by it.
    const bindings = { get: async () => undefined, byRequest: async () => undefined,
        put: async () => { throw new Error('Campus probe is read-only') } }
    const adapter = new LiveOfficialAdapter(config, transport, bindings)
    await adapter.checkConnection()
    const sources = await adapter.listSpaces()
    const spaces = []
    for (const source of sources) {
        const snapshot = await adapter.availability(source.id, date)
        spaces.push({ id: source.id, name: source.name, module: source.module,
            permission: source.permission, capacity: source.capacity,
            slots: snapshot.slots.length,
            available: snapshot.slots.filter(slot => slot.state === 'available').length })
    }
    const result = { event: 'campus.probe', authenticated: true, proxy: false,
        date, writesEnabled: config.writes.enabled, spaces }
    // Store only the non-personal room summary; never a raw official response.
    writeFileSync(resolve(directory, 'last-probe.json'), JSON.stringify(result, null, 2), { mode: 0o600 })
    console.log(JSON.stringify(result, null, 2))
}

main().catch(error => {
    console.error(error instanceof AdapterError ? error.code :
        error?.constructor?.name === 'ManualAuthenticationRequired'
            ? 'Official site requires manual verification; no login retry was attempted.'
            : 'CAMPUS_CHECK_FAILED')
    process.exitCode = 1
})
