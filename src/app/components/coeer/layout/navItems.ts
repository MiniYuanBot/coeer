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
            { to: '/notifications', label: '站内通知', icon: 'inbox', active: 'prefix' },
            { to: '/bookmarks', label: '我的收藏', icon: 'bookmark', active: 'prefix' },
            { to: '/activities', label: '活动', icon: 'calendar', active: 'prefix' },
        ],
    },
    {
        label: '服务',
        items: [
            { to: '/feedbacks', label: '反馈', icon: 'feedback', active: 'prefix' },
            { to: '/spaces', label: '空间预约', icon: 'calendar', active: 'prefix' },
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

export const adminNavItems: NavItem[] = [
    { to: '/admin', label: '工作台', icon: 'home', active: 'exact' },
    { to: '/admin/feedbacks', label: '反馈管理', icon: 'feedback' },
    { to: '/admin/groups', label: '群组管理', icon: 'group' },
    { to: '/admin/bulletins', label: '公告管理', icon: 'bell' },
    { to: '/admin/activities', label: '活动管理', icon: 'calendar' },
    { to: '/admin/redeems', label: '商城管理', icon: 'gift' },
    { to: '/admin/achievements', label: '成就管理', icon: 'award' },
    { to: '/admin/dorms', label: '宿舍管理', icon: 'bed' },
    { to: '/admin/spaces', label: '空间预约', icon: 'calendar' },
    { to: '/admin/stats', label: '用户统计', icon: 'activity' },
]

const pageLabels: Record<string, string> = {
    create: '新建', edit: '编辑', settings: '设置', members: '成员', posts: '帖子',
    announcements: '群组公告', admin: '群组管理', logs: '处理记录', pending: '待审核',
    bookings: '我的预约', orders: '兑换记录', catalog: '空间配置', allowlist: '预约白名单', history: '任务与审计',
}

/** Breadcrumbs contain navigable parents; database IDs never become visible labels. */
export function getBreadcrumbs(pathname: string): Array<{ to: string; label: string }> {
    const parts = pathname.split('/').filter(Boolean)
    if (!parts.length) return [{ to: '/', label: '学院社区' }, { to: '/', label: '动态' }]
    const root = parts[0] === 'admin' ? adminNavItem :
        [...navItems, { to: '/profile', label: '个人中心' }].find(item => item.to === '/' + parts[0])
    const crumbs = [{ to: root?.to || '/', label: root?.label || '学院社区' }]
    let start = 1
    if (parts[0] === 'admin' && parts[1]) {
        const section = adminNavItems.find(item => item.to === '/admin/' + parts[1])
        crumbs.push({ to: '/admin/' + parts[1], label: section?.label || '管理' })
        start = 2
    }
    for (let i = start; i < parts.length; i++) {
        const part = parts[i]
        let label = pageLabels[part] || (parts[i - 1] === 'bookings' ? '预约详情' : parts[0] === 'groups' && i === 1 ? '群组详情' : '详情')
        if (part === 'create') label = parts[0] === 'feedbacks' ? '提交反馈' : parts[i - 1] === 'posts' ? '发布帖子' : '创建群组'
        if (part === 'bookings' && parts[0] === 'admin') label = '预约与异常'
        crumbs.push({ to: '/' + parts.slice(0, i + 1).join('/'), label })
    }
    // Long group/post paths retain their module, immediate parent and current page.
    return crumbs.length > 3 ? [crumbs[0], ...crumbs.slice(-2)] : crumbs
}
