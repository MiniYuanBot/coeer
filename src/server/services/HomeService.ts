import { withAuthReadScope } from '../utils/auth-read-scope'
import { AuthService } from './AuthService'
import { GroupPostService } from './GroupPostService'
import { ActivityService } from './ActivityService'
import { FeedbackService } from './FeedbackService'
import { PointService } from './PointService'
import { bulletinQueries } from '../database/queries/bulletins'
import { groupMemberQueries } from '../database/queries/groupMembers'

export class HomeService {
    static async load() {
        return withAuthReadScope(async () => {
            const timings: string[] = []
            async function timed<T>(name: string, work: () => Promise<T>) {
                const start = performance.now()
                try { return await work() } finally { timings.push(`${name};dur=${(performance.now() - start).toFixed(1)}`) }
            }
            function unwrap<T>(response: { success: boolean; data?: T; state: { message?: string } }) {
                if (!response.success) throw new Error(response.state.message)
                return response.data
            }
            const auth = await timed('auth', () => AuthService.getCurrentUser())
            const user = auth.success ? auth.data ?? null : null
            const page = { limit: 5, offset: 0 }
            const [posts, bulletins, activities, feedbacks, groups, points] = await Promise.allSettled([
                timed('posts', async () => unwrap(await GroupPostService.listRecentPublic())),
                timed('bulletins', () => bulletinQueries.list({ ...page, type: 'official' })),
                timed('activities', () => ActivityService.listPublicFeed()),
                timed('feedbacks', async () => user ? FeedbackService.listPublicFeed() : []),
                timed('groups', async () => user ? groupMemberQueries.listByUser({ userId: user.id, limit: 8, offset: 0 }) : []),
                timed('points', async () => user ? unwrap(await PointService.getBalance()) : undefined),
            ])
            return {
                timing: timings.join(', '),
                data: {
                    user,
                    posts: posts.status === 'fulfilled' ? posts.value ?? [] : [],
                    bulletins: bulletins.status === 'fulfilled' ? bulletins.value : [],
                    activities: activities.status === 'fulfilled' ? activities.value : [],
                    feedbacks: feedbacks.status === 'fulfilled' ? feedbacks.value : [],
                    myGroups: groups.status === 'fulfilled' ? groups.value.map(member => member.group).filter(Boolean) : [],
                    balance: points.status === 'fulfilled' ? points.value?.balance ?? null : null,
                    feedErrors: {
                        bulletins: bulletins.status === 'rejected',
                        updates: posts.status === 'rejected' || activities.status === 'rejected',
                        feedbacks: feedbacks.status === 'rejected',
                        groups: groups.status === 'rejected',
                    },
                },
            }
        })
    }
}
