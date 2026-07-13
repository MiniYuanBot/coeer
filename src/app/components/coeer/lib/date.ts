export function formatDate(value?: string | Date | null) {
    if (!value) return '刚刚'
    return new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function formatDateTime(value?: string | Date | null) {
    if (!value) return '待定'
    return new Date(value).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
