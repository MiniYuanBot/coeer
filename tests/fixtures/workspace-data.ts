// UI-only fixtures: never connect these modules to a database or the booking engine.
export const query = new URLSearchParams(location.search)
export const screen = query.get('screen') ?? 'home'
export const state = query.get('state') ?? 'normal'
export const long = state === 'long'
export const empty = state === 'empty'
export const user = { id: 'ui-student', name: long ? '名字很长的学院社区同学'.repeat(5) : '林同学', email: long ? 'very-long-campus-address-'.repeat(6) + '@stu.pku.edu.cn' : '2026201234@stu.pku.edu.cn', studentId: '2026201234', role: (screen.startsWith('admin') ? 'admin' : 'student') as 'admin' | 'student' }
export const pathnames: Record<string, string> = { home: '/', guest: '/', feedbacks: '/feedbacks', detail: '/feedbacks/ui-feedback', profile: '/profile', spaces: '/spaces', slots: '/spaces/ui-space', bookings: '/spaces/bookings', booking: '/spaces/bookings/ui-booking', admin: '/admin/feedbacks', groups: '/groups', components: '/achievements', auth: '/login' }
export const pathname = pathnames[screen] ?? '/'
export const content = '学院服务正在持续改进。请保留必要的信息，让每一次协作都有清晰的进展。\n\n' + (long ? '这里是一段较长的正文，用于检查中文、English URLs https://example.com/long-path 和公式在不同宽度下的阅读体验。\n\n'.repeat(10) : '') + '## 处理说明\n\n- 已收到建议\n- 持续跟进结果\n\n行内公式 $x^2+y^2=1$。\n\n| 项目 | 状态 |\n| --- | --- |\n| 学院服务 | 跟进中 |'
export const feedbacks = empty ? [] : ['pending', 'processing', 'resolved', 'invalid'].map((status, index) => ({ id: 'ui-feedback-' + index, title: (long ? '关于学院公共学习空间和服务体验的详细改进建议'.repeat(5) : '自习空间照明与设施改进建议') + (index + 1), content, status, targetType: 'other', isPublic: true, authorId: user.id, author: user, createdAt: '2026-10-23T08:00:00Z' }))
export const group = { id: 'ui-group', slug: 'campus', name: '校园学习交流', description: content, category: 'study', status: 'approved', memberCount: 12, postCount: 4, createdAt: '2026-10-22T08:00:00Z' }
export const post = { id: 'ui-post', title: long ? '讨论标题'.repeat(30) : '分享这周的学习与校园生活', content, type: 'discussion', author: user, group, reactionCount: 5, hasReacted: false, isBookmarked: false, createdAt: '2026-10-23T08:00:00Z' }
export const space = { id: 'ui-space', name: long ? '学院公共会议与学习交流空间'.repeat(8) : '学院共享讨论室', location: '学院楼 201', capacity: 12, module: 'meeting', description: content, amenities: ['投影', '白板'], enabled: true }
export const booking = { id: 'ui-booking', spaceId: space.id, spaceName: space.name, module: 'meeting', date: '2099-10-25', start: 600, end: 660, quantity: 1, status: state === 'pending' ? 'queued' : 'confirmed', purpose: long ? '围绕课程学习与社团活动展开讨论。'.repeat(30) : '课程小组讨论', message: state === 'pending' ? '申请已保存，正在等待后台处理。' : '预约已确认，请按时使用。', createdAt: '2026-10-24T08:00:00Z', events: [{ id: 'event-1', status: 'queued', at: '2026-10-24T08:00:00Z', message: '申请已保存' }], applicantName: user.name, studentId: user.studentId }
export function loaderData(route: string): any {
    if (route === '/') return { user: screen === 'guest' ? null : user, posts: empty ? [] : [post], bulletins: empty ? [] : [{ id: 'ui-bulletin', title: '关于公共服务与校园活动的通知', content, createdAt: post.createdAt, isPinned: true }], activities: [], feedbacks, myGroups: empty ? [] : [group], balance: 125 }
    if (route.includes('/profile')) return { user, balance: 125, history: empty ? [] : Array.from({ length: 6 }, (_, index) => ({ id: String(index), amount: index % 2 ? -10 : 5, description: long ? '课程与社区交流记录'.repeat(20) : '社区参与积分', source: 'daily_visit' })), total: empty ? 0 : 6 }
    if (route.includes('$feedbackId')) return { feedback: feedbacks[0] ?? { ...post, targetType: 'other', status: 'processing' }, currentUser: user }
    if (route.includes('/feedbacks')) return { feedbacks, total: feedbacks.length, pageSize: 8 }
    if (route.includes('/groups')) return { groups: empty ? [] : [group], total: empty ? 0 : 1, pageSize: 9 }
    return {}
}
