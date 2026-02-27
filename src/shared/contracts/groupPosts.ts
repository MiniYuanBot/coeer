import { z } from 'zod';
import type { DbUser, Group, GroupPost } from '~/database/schemas';
import { GroupPostType, GroupPostCode } from '../constants'
import { ActionResponse, PaginatedActionResponse } from './action'

export interface GroupPostWithAuthor extends GroupPost {
    author: Pick<DbUser, 'id' | 'name'>;
}

export interface GroupPostWithGroup extends GroupPost {
    group: Pick<Group, 'id' | 'name' | 'slug'>;
}

export interface GroupPostFull extends GroupPost {
    author: Pick<DbUser, 'id' | 'name'>;
    group: Pick<Group, 'id' | 'name' | 'slug'>;
}

export interface CreateGroupPostData {
    groupId: string;
    title: string;
    content: string;
    type: GroupPostType;
}

export interface UpdateGroupPostData {
    title?: string;
    content?: string;
}

export interface TogglePinData {
    id: string;
    isPinned: boolean;
}

// ============================================
// Zod Schemas
// ============================================

export const CreateGroupPostSchema = z.object({
    groupId: z.uuid(),
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(10000),
    type: z.enum(['announcement', 'discussion']),
});

export const UpdateGroupPostSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(10000).optional(),
});

export const TogglePinSchema = z.object({
    id: z.uuid(),
    isPinned: z.boolean(),
});

// export const GroupPostListQuerySchema = z.object({
//     groupId: z.uuid('无效的群组ID'),
//     type: z.enum(GROUP_POST_TYPE_ARRAY).optional(),
//     isPinned: z
//         .string()
//         .transform((val) => val === 'true')
//         .optional(),
//     page: z
//         .string()
//         .transform((val) => parseInt(val, 10))
//         .pipe(z.number().min(1).default(1))
//         .optional(),
//     limit: z
//         .string()
//         .transform((val) => parseInt(val, 10))
//         .pipe(z.number().min(1).max(50).default(20))
//         .optional(),
// });

// export type CreateGroupPostInput = z.infer<typeof CreateGroupPostSchema>;
// export type UpdateGroupPostInput = z.infer<typeof UpdateGroupPostSchema>;
// export type TogglePinInput = z.infer<typeof TogglePinSchema>;
// export type GroupPostIdParam = z.infer<typeof GroupPostIdParamSchema>;
// export type GroupPostListQuery = z.infer<typeof GroupPostListQuerySchema>;

export interface GroupPostListResponse {
    posts: GroupPostWithAuthor[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface GroupPostDetailResponse {
    post: GroupPostFull;
    // related reactions、replies
}

// Response types
export type GroupPostResponse<T> = ActionResponse<T, GroupPostCode>
export type PaginatedGroupPostResponse<T> = PaginatedActionResponse<T, GroupPostCode>
