import { z } from 'zod';
import type { DbUser, Group, GroupPost } from '~/database/schemas';
import { GroupPostCode, GROUP_POST_TYPE_ARRAY } from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'

// ===== Zod Schemas ======

export const GroupPostIdSchema = z.object({
    id: z.uuid(),
})

export const AuthorIdSchema = z.object({
    authorId: z.uuid(),
})

export const CreateGroupPostSchema = z.object({
    groupId: z.uuid(),
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(10000),
    type: z.enum(GROUP_POST_TYPE_ARRAY),
});

export const UpdateGroupPostSchema = z.object({
    id: z.uuid(),
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(10000).optional(),
    updatedAt: z.date().optional(),
});

export const GroupPostFilterSchema = z.object({
    type: z.enum(GROUP_POST_TYPE_ARRAY).optional(),
    isPinned: z.boolean().optional(),
})

export const CountPostsByGroupSchema = z.object({
    groupId: z.uuid(),
    ...GroupPostFilterSchema.shape,
})

export const ListPostsByGroupSchema = z.object({
    ...CountPostsByGroupSchema.shape,
    ...PaginationSchema.shape,
})

export const CountPostsByAuthorSchema = z.object({
    authorId: z.uuid(),
    ...GroupPostFilterSchema.shape,
})

export const ListPostsByAuthorSchema = z.object({
    ...CountPostsByAuthorSchema.shape,
    ...PaginationSchema.shape,
})

export const TogglePinSchema = z.object({
    id: z.uuid(),
    isPinned: z.boolean(),
});

export const CheckGroupSchema = z.object({
    id: z.uuid(),
    groupId: z.uuid(),
});

export const CheckAuthorSchema = z.object({
    id: z.uuid(),
    authorId: z.uuid(),
});

export const CheckModifySchema = z.object({
    postId: z.uuid(),
    userId: z.uuid(),
});

// ===== Typescript Types =====

// Types from Zod
export type GroupPostIdInput = z.infer<typeof GroupPostIdSchema>
export type AuthorIdInput = z.infer<typeof AuthorIdSchema>
export type CreateGroupPostInput = z.infer<typeof CreateGroupPostSchema>
export type UpdateGroupPostInput = z.infer<typeof UpdateGroupPostSchema>
export type GroupPostFilterInput = z.infer<typeof GroupPostFilterSchema>
export type CountPostsByGroupInput = z.infer<typeof CountPostsByGroupSchema>
export type ListPostsByGroupInput = z.infer<typeof ListPostsByGroupSchema>
export type CountPostsByAuthorInput = z.infer<typeof CountPostsByAuthorSchema>
export type ListPostsByAuthorInput = z.infer<typeof ListPostsByAuthorSchema>
export type TogglePinInput = z.infer<typeof TogglePinSchema>
export type CheckGroupInput = z.infer<typeof CheckGroupSchema>
export type CheckAuthorInput = z.infer<typeof CheckAuthorSchema>
export type CheckModifyInput = z.infer<typeof CheckModifySchema>

export interface GroupPostWithAuthor extends GroupPost {
    author: Pick<DbUser, 'id' | 'name'> | null;
}

export interface GroupPostWithGroup extends GroupPost {
    group: Pick<Group, 'id' | 'name' | 'slug'>;
}

export interface GroupPostFull extends GroupPost {
    author: Pick<DbUser, 'id' | 'name'>;
    group: Pick<Group, 'id' | 'name' | 'slug'>;
}

// Response types
export type GroupPostResponse<T> = ActionResponse<T, GroupPostCode>
export type PaginatedGroupPostResponse<T> = PaginatedActionResponse<T, GroupPostCode>