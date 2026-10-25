import type { ComponentProps } from 'react'
import { Badge } from './Badge'

type Tone = ComponentProps<typeof Badge>['tone']
const tones: Record<string, Tone> = {
    pending: 'warning', pending_review: 'warning', pending_approval: 'warning', review: 'warning',
    processing: 'primary', registered: 'primary', published: 'success', active: 'success',
    approved: 'success', resolved: 'success', completed: 'success', attended: 'success',
    confirmed: 'success', allowed: 'success', rejected: 'danger', invalid: 'danger',
    blocked: 'danger', failed: 'danger', manual_review: 'warning', uncertain: 'warning', cancel_uncertain: 'warning',
    success: 'success', done: 'success', running: 'primary', ongoing: 'primary', upcoming: 'warning',
}

export function StatusBadge({ status, labels, tone }: { status: string; labels: Record<string, string>; tone?: Tone }) {
    return <Badge tone={tone ?? tones[status] ?? 'default'}>{labels[status] || status}</Badge>
}

export function VisibilityBadge({ visible, hiddenLabel = '隐藏', publicLabel = '公开' }: { visible: boolean; hiddenLabel?: string; publicLabel?: string }) {
    return <Badge tone={visible ? 'success' : 'default'}>{visible ? publicLabel : hiddenLabel}</Badge>
}
