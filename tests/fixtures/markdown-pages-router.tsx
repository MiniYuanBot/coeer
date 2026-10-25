export { Link, useNavigate, useRouter } from './admin-navigation'
import { fixtureSearch } from './admin-navigation'

export const initialContent = '**已有正文**，行内公式 $u=x^2$。\n\n$$\n\\frac{1}{2}\n$$'
export const anotherContent = '**另一条正文** $v=y^3$'
export const bulletinItems = [
    { id: 'bulletin-a', title: '公告甲', type: 'official', content: initialContent },
    { id: 'bulletin-b', title: '公告乙', type: 'official', content: anotherContent },
]
export const activityItems = [
    { id: 'activity-a', title: '活动甲', type: 'official', status: 'upcoming', description: initialContent, startTime: new Date('2027-01-01T10:00:00Z'), endTime: new Date('2027-01-01T12:00:00Z') },
    { id: 'activity-b', title: '活动乙', type: 'official', status: 'upcoming', description: anotherContent, startTime: new Date('2027-01-02T10:00:00Z'), endTime: new Date('2027-01-02T12:00:00Z') },
]

export function createFileRoute(path: string) {
    return (options: { validateSearch?: { parse: (value: unknown) => unknown } }) => ({
        options,
        useRouteContext: () => ({ group: { id: 'group', name: '测试群组' }, isAdmin: true,
            post: { id: 'post', title: '已有帖子', content: initialContent, type: 'discussion' } }),
        useParams: () => ({ slug: 'test-group', postId: 'post' }),
        useSearch: () => options.validateSearch?.parse(fixtureSearch()) ?? { page: 1 },
        useLoaderData: () => path.endsWith('/edit')
            ? (path.includes('/bulletins/') ? bulletinItems : activityItems).find(item => window.location.hash.includes(item.id))!
            : path.includes('/bulletins/') ? { bulletins: bulletinItems, total: 2 }
            : { activities: activityItems, participants: [{ id: 'participant-a', activity: activityItems[0], user: { name: '测试用户' }, status: 'registered', registeredAt: new Date() }], total: 1 },
    })
}

export function redirect() { return new Error('redirect') }
