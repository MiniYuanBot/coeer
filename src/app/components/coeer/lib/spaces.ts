import type { BookingStatus } from '@shared/open-space/domain'
import type { BadgeTone } from './types'

export const spaceModuleLabels = { meeting: '会议空间', activity: '共享活动室' }
export const bookingStatusTone = (status: BookingStatus): BadgeTone =>
    status === 'confirmed'
        ? 'success'
        : status === 'failed'
          ? 'danger'
          : ['pending_review', 'pending_approval', 'uncertain', 'manual_review', 'cancel_uncertain'].includes(
                  status,
              )
            ? 'warning'
            : status === 'cancelled'
              ? 'default'
              : 'primary'
export const formatSpaceTime = (at?: number | null) =>
    at ? new Date(at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '尚未完成'
export const syncLabel = (at?: number | null) =>
    at
        ? `更新于 ${new Date(at).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`
        : '等待同步'
export const scenarioLabels: Record<string, string> = {
    success: '正常处理',
    approval: '需要审批',
    conflict: '官方冲突',
    timeout_after_create: '创建后超时',
    timeout_before_create: '创建前超时',
    network: '网络异常',
    auth_expired: '身份失效',
    cancel_timeout: '取消后超时',
    unknown: '未知状态',
}
