import { AdapterError, type CreateCommand, type OfficialAdapter, type OperationOptions } from '../adapter.js'
import type { LiveOfficialAdapter } from './live.js'

export interface ReadAuthentication {
    beforeRead(options?: OperationOptions): Promise<void>
    diagnostics(): Record<string, unknown>
}

/** Match the isolated connector's operation queue without replaying a write. */
export class AuthenticatedOfficialAdapter implements OfficialAdapter {
    readonly mode = 'official' as const
    #tail = Promise.resolve()
    #queued = 0
    #beginSync = false

    constructor(private adapter: LiveOfficialAdapter, private authentication: ReadAuthentication) {}
    get operationTimeoutMs() { return this.adapter.operationTimeoutMs }
    get rulesSource() { return this.adapter.rulesSource }
    get syncIntervalMs() { return this.adapter.syncIntervalMs }
    get reconcileIntervalMs() { return this.adapter.reconcileIntervalMs }
    get defaultHorizon() { return this.adapter.defaultHorizon }
    get catalogComplete() { return this.adapter.catalogComplete }
    diagnostics() {
        return { ...this.adapter.diagnostics(), authenticationRecovery: this.authentication.diagnostics() }
    }
    publication(spaceId: string) { return this.adapter.publication(spaceId) }
    checkCreate(command: CreateCommand) { return this.adapter.checkCreate(command) }
    beginSync() { this.#beginSync = true }
    listSpaces(options?: OperationOptions) {
        return this.serial(async () => {
            if (this.#beginSync) {
                await this.authentication.beforeRead(options)
                this.adapter.beginSync()
                this.#beginSync = false
            }
            return this.adapter.listSpaces(options)
        }, options)
    }
    availability(spaceId: string, date: string, options?: OperationOptions) {
        return this.serial(() => this.adapter.availability(spaceId, date, options), options)
    }
    get(ref: string, options?: OperationOptions) {
        return this.serial(async () => {
            await this.authentication.beforeRead(options)
            return this.adapter.get(ref, options)
        }, options)
    }
    checkConnection(options?: OperationOptions) {
        return this.serial(async () => {
            await this.authentication.beforeRead(options)
            return this.diagnostics()
        }, options)
    }
    create(command: CreateCommand, options?: OperationOptions) {
        return this.serial(() => this.adapter.create(command, options), options)
    }
    cancel(ref: string, options?: OperationOptions) {
        return this.serial(() => this.adapter.cancel(ref, options), options)
    }
    attachReference(command: CreateCommand, ref: string, options?: OperationOptions) {
        return this.serial(() => this.adapter.attachReference(command, ref, options), options)
    }
    private async serial<T>(operation: () => Promise<T>, options?: OperationOptions): Promise<T> {
        if (this.#queued >= 20) throw new AdapterError('RATE_LIMITED')
        this.#queued++
        const previous = this.#tail
        let release!: () => void
        this.#tail = new Promise<void>(resolve => { release = resolve })
        try {
            await previous
            if (options?.signal?.aborted) throw new AdapterError('TIMEOUT')
            return await operation()
        } finally {
            this.#queued--
            release()
        }
    }
}
