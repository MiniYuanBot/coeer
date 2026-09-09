import type { FeedbackStatus } from '@shared/constants'
import { Badge, feedbackStatusLabels, feedbackTargetLabels } from '@/components/coeer'
import type { BadgeTone } from '@/components/coeer'

// 标签文案统一以 lib/labels 为准（这里只做 re-export，避免双份映射漂移）
export { feedbackStatusLabels, feedbackTargetLabels }

export function feedbackStatusTone(status: FeedbackStatus): BadgeTone {
    if (status === 'resolved') return 'success'
    if (status === 'processing') return 'primary'
    if (status === 'invalid') return 'danger'
    return 'warning'
}

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
    return <Badge tone={feedbackStatusTone(status)}>{feedbackStatusLabels[status]}</Badge>
}
