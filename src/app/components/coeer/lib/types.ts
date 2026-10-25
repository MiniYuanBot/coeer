export type SessionUser = {
    avatarUrl?: string | null
    email: string
    name?: string | null
    role: 'student' | 'moderator' | 'admin'
} | null | undefined

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

export type BadgeTone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted'

export type IconName =
    | 'inbox'
    | 'plus'
    | 'panel'
    | 'filter'
    | 'list'
    | 'activity'
    | 'award'
    | 'bell'
    | 'bookmark'
    | 'calendar'
    | 'card'
    | 'check'
    | 'pause'
    | 'play'
    | 'chevron'
    | 'coins'
    | 'comment'
    | 'feedback'
    | 'gift'
    | 'group'
    | 'heart'
    | 'home'
    | 'bed'
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
