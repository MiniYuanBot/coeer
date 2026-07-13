import * as React from 'react'
import { useToast } from '../feedback/Toast'

export function useAsyncAction() {
    const { toast } = useToast()
    const [loadingKey, setLoadingKey] = React.useState<string | null>(null)

    async function run(key: string, action: () => Promise<unknown>, messages: { loading?: string; success: string; error: string }) {
        setLoadingKey(key)
        try {
            await action()
            toast({ title: messages.success, tone: 'success' })
        } catch (error) {
            toast({ title: messages.error, description: error instanceof Error ? error.message : undefined, tone: 'danger' })
        } finally {
            setLoadingKey(null)
        }
    }

    return { loadingKey, run }
}
