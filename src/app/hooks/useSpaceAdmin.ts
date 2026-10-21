import { useState } from 'react'
import type { SpaceAdminData } from '@shared/contracts/spaces'
import { spaceApi, useSpaceResource } from './useSpaces'
import { useToast } from '@/components/coeer'

export function useSpaceAdmin() {
    const resource = useSpaceResource<SpaceAdminData>('/admin/overview', 10000)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const { toast } = useToast()
    async function mutate(path: string, body: unknown = {}, method = 'POST', message = '操作已完成') {
        setPending(true)
        setError('')
        try {
            await spaceApi(path, { method, body: JSON.stringify(body) })
            resource.reload()
            toast({ title: message, tone: 'success' })
            return true
        } catch (error) {
            setError((error as Error).message)
            return false
        } finally {
            setPending(false)
        }
    }
    return { ...resource, error: error || resource.error, pending, mutate }
}
