export type EmbeddedSpaceRuntime = { url: string; close: () => Promise<void> }

/** Startup is explicit; reads share its result and never create or retry a worker. */
export function createRuntimeLifecycle(factory: () => Promise<EmbeddedSpaceRuntime>, report: (error: unknown) => void) {
    let current: Promise<EmbeddedSpaceRuntime> | undefined
    let raw: EmbeddedSpaceRuntime | undefined
    let stopping: Promise<void> | undefined
    const unavailable = () => Promise.reject<EmbeddedSpaceRuntime>(new Error('Space background runtime has not started'))

    function start() {
        if (stopping) return unavailable()
        return current ??= Promise.resolve().then(factory).then((runtime) => {
            raw = runtime
            return { url: runtime.url, close: stop }
        }).catch((error) => {
            report(error)
            throw error
        })
    }
    function get() {
        return stopping ? unavailable() : current ?? unavailable()
    }
    function stop(): Promise<void> {
        if (stopping) return stopping
        if (!current) return Promise.resolve()
        const target = current
        stopping = (async () => {
            try {
                await target.catch(() => undefined)
                await raw?.close()
            } finally {
                if (current === target) current = undefined
                raw = undefined
                stopping = undefined
            }
        })()
        return stopping
    }
    return { start, get, stop }
}
