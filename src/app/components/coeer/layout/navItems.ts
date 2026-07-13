import type { IconName } from '../lib/types'

export const navItems: Array<{ to: string; label: string; icon: IconName }> = [
    { to: '/', label: '动态', icon: 'home' },
    { to: '/groups', label: '群组', icon: 'group' },
    { to: '/bulletins', label: '公告', icon: 'bell' },
    { to: '/activities', label: '活动', icon: 'calendar' },
    { to: '/feedbacks', label: '反馈', icon: 'feedback' },
    { to: '/redeems', label: '商城', icon: 'gift' },
    { to: '/achievements', label: '成就', icon: 'award' },
]
