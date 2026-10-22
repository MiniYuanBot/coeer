import { AuthService } from './AuthService'
import { bookmarkQueries } from '../database/queries/bookmarks'
import { reactionQueries } from '../database/queries/reactions'
import { canViewTarget } from '../utils/access'
import type { ListBookmarksInput, SetBookmarkInput } from '@shared/contracts/bookmarks'

export class BookmarkService {
    private static async currentUser() {
        const result = await AuthService.getCurrentUser()
        if (!result.success || !result.data) throw new Error('请先登录')
        return result.data
    }
    static async set(data: SetBookmarkInput) {
        const user = await this.currentUser()
        if (data.bookmarked && !await canViewTarget({ targetType: 'group_post', targetId: data.postId }, user)) {
            throw new Error('帖子不存在或无权查看')
        }
        return bookmarkQueries.set(user.id, data)
    }
    static async list(data: ListBookmarksInput) {
        const user = await this.currentUser()
        const result = await bookmarkQueries.list(user, data)
        const likes = await reactionQueries.summarizePosts(result.items.map((item) => item.post.id), user.id)
        return { ...result, items: result.items.map((item) => ({ ...item,
            post: { ...item.post, reactionCount: 0, hasReacted: false, ...likes.get(item.post.id) },
        })) }
    }
}
