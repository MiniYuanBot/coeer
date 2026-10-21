import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { SpaceConfig, SpaceSession } from '@shared/contracts/spaces'

let csrf: string | null = null
export async function spaceApi<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`/api/open-space${path}`, {
        ...options,
        credentials: 'same-origin',
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
            ...options.headers,
        },
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
        if (body?.error?.code === 'UNAUTHORIZED') window.dispatchEvent(new Event('booking-session-expired'))
        if (body?.error?.code === 'COEER_UNAUTHORIZED')
            window.location.assign(
                `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`,
            )
        throw new Error(body?.error?.message ?? '预约服务暂不可用，请稍后重试')
    }
    if (body === null) throw new Error('服务返回的结果无法识别，请刷新后查看')
    return body as T
}
export function useSpaceResource<T>(path: string | null, poll = 0) {
    const [state, setState] = useState<{ path: string | null; data?: T; error: string; loading: boolean }>({
        path,
        error: '',
        loading: !!path,
    })
    const [version, setVersion] = useState(0)
    useEffect(() => {
        let active = true
        const controller = new AbortController()
        let timer: ReturnType<typeof setTimeout> | undefined
        setState((current) =>
            current.path === path
                ? { ...current, error: '', loading: !!path && current.data === undefined }
                : { path, error: '', loading: !!path },
        )
        async function load() {
            if (!path) return
            try {
                const data = await spaceApi<T>(path, { signal: controller.signal })
                if (active) setState({ path, data, error: '', loading: false })
            } catch (error) {
                if (active && !controller.signal.aborted)
                    setState((current) => ({ ...current, loading: false, error: (error as Error).message }))
            } finally {
                if (active && poll) timer = setTimeout(() => void load(), poll)
            }
        }
        void load()
        return () => {
            active = false
            controller.abort()
            if (timer) clearTimeout(timer)
        }
    }, [path, poll, version])
    return {
        ...(state.path === path ? state : { path, error: '', loading: !!path, data: undefined }),
        reload: () => setVersion((value) => value + 1),
    }
}

type SpaceState = {
    config?: SpaceConfig
    user: SpaceSession['user']
    loading: boolean
    error: string
    updateSession: (session: SpaceSession) => void
    reload: () => void
}
const Context = createContext<SpaceState | null>(null)
export function useSpaces() {
    const state = useContext(Context)
    if (!state) throw new Error('Booking data requires the authenticated route provider')
    return state
}

/** Data and account state only; all presentation belongs to COEER's routes. */
export function SpacesProvider({ children }: { children: ReactNode }) {
    const configuration = useSpaceResource<SpaceConfig>('/config', 10000)
    const [session, setSession] = useState<SpaceSession>({ user: null, csrf: null })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [version, setVersion] = useState(0)
    function updateSession(value: SpaceSession) {
        csrf = value.csrf
        setSession(value)
    }
    useEffect(() => {
        let active = true
        const controller = new AbortController()
        csrf = null
        setLoading(true)
        const expire = () => updateSession({ user: null, csrf: null })
        window.addEventListener('booking-session-expired', expire)
        void spaceApi<SpaceSession>('/auth/me', { signal: controller.signal })
            .then((value) => {
                if (active) {
                    updateSession(value)
                    setError('')
                }
            })
            .catch((error) => {
                if (active) setError((error as Error).message)
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => {
            active = false
            controller.abort()
            csrf = null
            window.removeEventListener('booking-session-expired', expire)
        }
    }, [version])
    return (
        <Context.Provider
            value={{
                config: configuration.data,
                user: session.user,
                loading: loading || configuration.loading,
                error: error || configuration.error,
                updateSession,
                reload: () => {
                    configuration.reload()
                    setVersion((value) => value + 1)
                },
            }}
        >
            {children}
        </Context.Provider>
    )
}
