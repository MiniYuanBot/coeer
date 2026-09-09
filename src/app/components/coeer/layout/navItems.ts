import type { IconName } from '../lib/types'

export type NavItem = {
    to: string
    label: string
    icon: IconName
    /** match strategy for the active state */
    active?: 'exact' | 'prefix'
}

export type NavSection = {
    label: string
    items: NavItem[]
}

/** Authenticated app navigation (rendered in the sidebar). */
export const navSections: NavSection[] = [
    {
        label: '社区',
        items: [
            { to: '/', label: '动态', icon: 'home', active: 'exact' },
            { to: '/groups', label: '群组', icon: 'group', active: 'prefix' },
            { to: '/bulletins', label: '公告', icon: 'bell', active: 'prefix' },
            { to: '/activities', label: '活动', icon: 'calendar', active: 'prefix' },
        ],
    },
    {
        label: '服务',
        items: [
            { to: '/feedbacks', label: '反馈', icon: 'feedback', active: 'prefix' },
            { to: '/dorms', label: '宿舍', icon: 'bed', active: 'prefix' },
        ],
    },
    {
        label: '成长',
        items: [
            { to: '/redeems', label: '商城', icon: 'gift', active: 'prefix' },
            { to: '/achievements', label: '成就', icon: 'award', active: 'prefix' },
        ],
    },
]

/** Flat list kept for compatibility with legacy callers. */
export const navItems: Array<NavItem> = navSections.flatMap((section) => section.items)

/** Extra top-level destination only visible to admins. */
export const adminNavItem: NavItem = { to: '/admin', label: '管理后台', icon: 'spark', active: 'prefix' }
