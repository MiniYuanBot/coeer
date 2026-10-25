export class OverloadedError extends Error {
    readonly code = 'SERVER_BUSY'
    constructor() { super('服务繁忙，请稍后重试') }
}

/** Bound work before it acquires scarce resources such as database connections. */
export class ConcurrencyGate {
    private active = 0
    private readonly waiting = new Set<() => void>()

    constructor(private readonly limit: number, private readonly maxWaiting: number, private readonly waitMs: number) {
        if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(maxWaiting) || maxWaiting < 0 ||
            !Number.isFinite(waitMs) || waitMs <= 0) throw new Error('Invalid concurrency limits')
    }

    private async acquire() {
        if (this.active < this.limit) { this.active++; return }
        if (this.waiting.size >= this.maxWaiting) throw new OverloadedError()
        await new Promise<void>((resolve, reject) => {
            const resume = () => { clearTimeout(timer); resolve() }
            const timer = setTimeout(() => {
                this.waiting.delete(resume)
                reject(new OverloadedError())
            }, this.waitMs)
            this.waiting.add(resume)
        })
    }

    async run<T>(work: () => T | Promise<T>): Promise<T> {
        await this.acquire()
        try { return await work() } finally {
            const next = this.waiting.values().next().value
            // Transfer the slot directly so new arrivals cannot overtake queued work.
            if (next) { this.waiting.delete(next); next() }
            else this.active--
        }
    }
}
