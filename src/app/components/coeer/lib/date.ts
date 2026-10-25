const dateFormatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export function formatDate(value?: string | Date | null) {
    if (!value) return '刚刚'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? date.toString() : dateFormatter.format(date)
}

export function formatDateTime(value?: string | Date | null) {
    if (!value) return '待定'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? date.toString() : dateTimeFormatter.format(date)
}
