import type { PointSource } from './points'

export const ENGAGEMENT_REWARDS = {
    daily: { source: 'daily_login', amount: 5, dailyLimit: 1, label: '每日活跃' },
    feedback: { source: 'feedback', amount: 10, dailyLimit: 2, label: '提交反馈' },
    post: { source: 'group_post', amount: 5, dailyLimit: 3, label: '发布群组帖子' },
    reply: { source: 'group_post', amount: 2, dailyLimit: 5, label: '参与群组回复' },
    attendance: { source: 'activity', amount: 20, dailyLimit: 3, label: '活动签到' },
} as const satisfies Record<string, { source: PointSource; amount: number; dailyLimit: number; label: string }>

export type EngagementAction = keyof typeof ENGAGEMENT_REWARDS

/** Reward days follow campus time, independent of the server's local timezone. */
export function engagementDay(now = new Date()) {
    const offset = 8 * 60 * 60 * 1000
    const day = new Date(now.getTime() + offset).toISOString().slice(0, 10)
    const start = new Date(`${day}T00:00:00+08:00`)
    return { day, start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
}
