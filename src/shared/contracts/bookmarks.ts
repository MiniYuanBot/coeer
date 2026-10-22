import { z } from 'zod'
import { PaginationSchema } from './shared'

export const SetBookmarkSchema = z.object({ postId: z.uuid(), bookmarked: z.boolean() })
export const ListBookmarksSchema = PaginationSchema.extend({ limit: z.number().int().min(1).max(100).default(20) })
export type SetBookmarkInput = z.infer<typeof SetBookmarkSchema>
export type ListBookmarksInput = z.infer<typeof ListBookmarksSchema>
