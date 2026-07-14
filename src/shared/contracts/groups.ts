import { z } from 'zod'
import type { DbUser, Group } from '~/database/schemas'
import {
    GROUP_CATEGORY_ARRAY,
    GROUP_MEMBER_ROLE_ARRAY,
    GROUP_STATUS_ARRAY,
    GroupCode,
} from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'
import { GroupMemberFilterSchema } from './groupMembers'

// ===== Zod Schemas ======

export const GroupSlugSchema = z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
})

export const GroupIdSchema = z.object({
    groupId: z.uuid(),
})

export const GroupAndUserSchema = z.object({
    groupId: z.string(),
    userId: z.string(),
})

export const CreateGroupSchema = z.object({
    name: z.string().min(2).max(100),
    slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
    description: z.string().max(500).optional(),
    category: z.enum(GROUP_CATEGORY_ARRAY),
    isPublic: z.boolean(),
    // avatarUrl: z.url().optional(),
})

export const UpdateGroupSchema = z.object({
    id: z.uuid(),
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    isPublic: z.boolean().optional(),
    updatedAt: z.date().optional(),
})

export const UpdateGroupStatusSchema = z.object({
    id: z.uuid(),
    status: z.enum(GROUP_STATUS_ARRAY),
    rejectedReason: z.string().max(200).optional(),
    reviewNote: z.string().max(1000).optional(),
})

export const ApproveGroupSchema = z.object({
    id: z.uuid(),
    approved: z.boolean(),
    rejectedReason: z.string().max(200).optional(),
})

export const GroupFilterSchema = z.object({
    status: z.enum(GROUP_STATUS_ARRAY).optional(),
    category: z.enum(GROUP_CATEGORY_ARRAY).optional(),
    search: z.string().optional(),
})

export const GroupIdWithFilterSchema = z.object({
    groupId: z.uuid(),
    ...GroupFilterSchema.shape,
})

export const GroupSlugWithFilterSchema = z.object({
    slug: z.uuid(),
    ...GroupFilterSchema.shape,
})

export const ListAllGroupsSchema = z.object({
    ...GroupFilterSchema.shape,
    ...PaginationSchema.shape,
})

export const ListMyGroupsSchema = z.object({
    ...GroupMemberFilterSchema.shape,
    ...PaginationSchema.shape,
})

export const CheckRoleSchema = z.object({
    groupId: z.uuid(),
    userId: z.uuid(),
    role: z.enum(GROUP_MEMBER_ROLE_ARRAY),
})

// ===== Typescript Types =====

// Types from Zod
export type GroupSlugInput = z.infer<typeof GroupSlugSchema>
export type GroupIdInput = z.infer<typeof GroupIdSchema>
export type GroupAndUserInput = z.infer<typeof GroupAndUserSchema>
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>
export type UpdateGroupStatusInput = z.infer<typeof UpdateGroupStatusSchema>
export type ApproveGroupInput = z.infer<typeof ApproveGroupSchema>
export type GroupFilterInput = z.infer<typeof GroupFilterSchema>
export type GroupIdWithFilterInput = z.infer<typeof GroupIdWithFilterSchema>
export type GroupSlugWithFilterInput = z.infer<typeof GroupSlugWithFilterSchema>
export type ListAllGroupsInput = z.infer<typeof ListAllGroupsSchema>
export type ListMyGroupsInput = z.infer<typeof ListMyGroupsSchema>
export type CheckRoleInput = z.infer<typeof CheckRoleSchema>

// Group with creator info
export type GroupWithCreator = Group & {
    creator: Pick<DbUser, 'id' | 'name'> | null
}

// Group with statistics
export type GroupWithStats = GroupWithCreator & {
    memberCount: number
    postCount: number
}

export type GroupResponse<T> = ActionResponse<T, GroupCode>
export type PaginatedGroupResponse<T> = PaginatedActionResponse<T, GroupCode>
