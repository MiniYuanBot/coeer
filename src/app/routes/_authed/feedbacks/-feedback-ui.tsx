import type { FeedbackStatus } from '@shared/constants'
import { Badge } from '@/components/coeer'
import type { BadgeTone } from '@/components/coeer'

export const feedbackStatusLabels: Record<FeedbackStatus, string> = {
    pending: '待审核',
    processing: '已公开',
    resolved: '已解决',
    invalid: '已驳回',
}

export const feedbackTargetLabels = {
    academic: '学业事务',
    office: '办公室事务',
    general: '综合建议',
} as const

export function feedbackStatusTone(status: FeedbackStatus): BadgeTone {
    if (status === 'resolved') return 'success'
    if (status === 'processing') return 'primary'
    if (status === 'invalid') return 'danger'
    return 'warning'
}

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
    return <Badge tone={feedbackStatusTone(status)}>{feedbackStatusLabels[status]}</Badge>
}
