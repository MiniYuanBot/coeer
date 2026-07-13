export type SessionUser = {
    email: string
    name?: string | null
    role: 'student' | 'moderator' | 'admin'
} | null | undefined

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

export type BadgeTone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted'

export type IconName =
    | 'activity'
    | 'award'
    | 'bell'
    | 'bookmark'
    | 'calendar'
    | 'card'
    | 'check'
    | 'chevron'
    | 'coins'
    | 'comment'
    | 'feedback'
    | 'gift'
    | 'group'
    | 'heart'
    | 'home'
    | 'login'
    | 'logout'
    | 'menu'
    | 'moon'
    | 'search'
    | 'send'
    | 'spark'
    | 'sun'
    | 'user'
    | 'x'
