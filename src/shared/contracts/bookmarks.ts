import { z } from 'zod'
import { PaginationSchema } from './shared'
import { GROUP_POST_TYPE_ARRAY } from '../constants/groupPosts'

export const SetBookmarkSchema = z.object({ postId: z.uuid(), bookmarked: z.boolean() })
export const ListBookmarksSchema = PaginationSchema.extend({
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
    type: z.enum(GROUP_POST_TYPE_ARRAY).optional(),
})
export type SetBookmarkInput = z.infer<typeof SetBookmarkSchema>
export type ListBookmarksInput = z.infer<typeof ListBookmarksSchema>
