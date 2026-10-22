import { createElement, type AnchorHTMLAttributes } from 'react'

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
    return (options: unknown) => ({
        options,
        useRouteContext: () => ({ group: { id: 'group', name: '测试群组' }, isAdmin: true,
            post: { id: 'post', title: '已有帖子', content: initialContent, type: 'discussion' } }),
        useParams: () => ({ slug: 'test-group', postId: 'post' }),
        useSearch: () => ({ page: 1 }),
        useLoaderData: () => path.endsWith('bulletins') ? { bulletins: bulletinItems } : { activities: activityItems },
    })
}

export function useNavigate() { return async () => {} }
export function redirect() { return new Error('redirect') }
export function Link({ to, params, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; params?: unknown }) {
    return createElement('a', { ...props, href: to || '#' })
}
