import { z } from 'zod'
import type { Activity, Bulletin, Feedback, GroupPost } from '~/database/schemas'
import { BulletinCode, BULLETIN_SOURCE_TYPE_ARRAY, BULLETIN_TYPE_ARRAY } from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'

export const BulletinIdSchema = z.object({
    id: z.uuid(),
})

export const CreateBulletinSchema = z.object({
    type: z.enum(BULLETIN_TYPE_ARRAY),
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(5000),
    sourceId: z.uuid().optional(),
    sourceType: z.enum(BULLETIN_SOURCE_TYPE_ARRAY).optional(),
    isPinned: z.boolean().optional().default(false),
})

export const UpdateBulletinSchema = z.object({
    id: z.uuid(),
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(5000).optional(),
    isPinned: z.boolean().optional(),
})

export const ListBulletinsSchema = z.object({
    type: z.enum(BULLETIN_TYPE_ARRAY).optional(),
    isPinned: z.boolean().optional(),
    search: z.string().optional(),
    ...PaginationSchema.shape,
})

export type BulletinIdInput = z.infer<typeof BulletinIdSchema>
export type CreateBulletinInput = z.infer<typeof CreateBulletinSchema>
export type UpdateBulletinInput = z.infer<typeof UpdateBulletinSchema>
export type ListBulletinsInput = z.infer<typeof ListBulletinsSchema>

export type BulletinWithSource = Bulletin & {
    source?: Feedback | GroupPost | Activity | null
}

export type BulletinResponse<T> = ActionResponse<T, BulletinCode>
export type PaginatedBulletinResponse<T> = PaginatedActionResponse<T, BulletinCode>
