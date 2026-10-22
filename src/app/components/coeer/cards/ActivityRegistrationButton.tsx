import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import type { ActivityWithOrganizer } from '@shared/contracts/activities'
import { cancelRegistrationFn, registerActivityFn } from '~/functions/activities'
import { useToast } from '../feedback/Toast'
import { activityStatusLabels } from '../lib/labels'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

export function ActivityRegistrationButton({ activity, label = '报名' }: {
    activity: Pick<ActivityWithOrganizer, 'id' | 'status' | 'myParticipation'>
    label?: string
}) {
    const router = useRouter()
    const client = useQueryClient()
    const { toast } = useToast()
    const [pending, setPending] = useState(false)
    const participationStatus = activity.myParticipation?.status
    const registered = participationStatus === 'registered'
    const attended = participationStatus === 'attended'
    async function updateRegistration() {
        if (pending) return
        setPending(true)
        try {
            if (registered && activity.myParticipation) {
                await cancelRegistrationFn({ data: { participantId: activity.myParticipation.id } })
            } else {
                await registerActivityFn({ data: { activityId: activity.id } })
            }
            toast({ title: registered ? '已取消报名' : '报名成功', tone: 'success' })
            await Promise.allSettled([router.invalidate(), client.invalidateQueries({ queryKey: ['notifications'] })])
        } catch (error) {
            toast({ title: registered ? '取消报名失败' : '报名失败', description: error instanceof Error ? error.message : '请稍后重试', tone: 'danger' })
        } finally { setPending(false) }
    }
    return <Button className="w-full" variant={registered ? 'outline' : activity.status === 'upcoming' ? 'primary' : 'ghost'}
        loading={pending} disabled={attended || (!registered && activity.status !== 'upcoming')} onClick={() => void updateRegistration()}>
        <Icon name={registered ? 'x' : 'check'} /> {attended ? '已签到' : registered ? '取消报名' : activity.status === 'upcoming' ? label : activityStatusLabels[activity.status]}
    </Button>
}
