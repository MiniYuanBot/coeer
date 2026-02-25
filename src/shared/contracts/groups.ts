// contracts/groups.ts
import { z } from 'zod'
import type { DbUser, Group } from '~/database/schemas'
import { GROUP_CATEGORIES_ARRAY, GroupCategories, GroupCode } from '../constants'
import { ActionResponse, PaginatedActionResponse } from './action'

// Zod Schemas
export const CreateGroupSchema = z.object({
    name: z.string().min(2).max(100),
    slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
    description: z.string().max(500).optional(),
    category: z.enum(GROUP_CATEGORIES_ARRAY),
    isPublic: z.boolean(),
})

export const UpdateGroupSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    // avatarUrl: z.url().optional(),
    isPublic: z.boolean().optional(),
})

export const JoinGroupSchema = z.object({
    groupId: z.uuid(),
})

export const ApproveGroupSchema = z.object({
    id: z.uuid(),
    approved: z.boolean(),
    rejectedReason: z.string().max(200).optional(),
})

// Types from Zod
export type CreateGroupData = z.infer<typeof CreateGroupSchema>
export type UpdateGroupData = z.infer<typeof UpdateGroupSchema>
export type JoinGroupData = z.infer<typeof JoinGroupSchema>
export type ApproveGroupData = z.infer<typeof ApproveGroupSchema>
// export type UpdateMemberRoleData = z.infer<typeof UpdateGroupMemberRoleSchema>

// // Group types
// export type Group = DbGroup
// export type GroupStatus = typeof GroupStatuses[keyof typeof GroupStatuses]
// export type GroupCategory = typeof GroupCategories[keyof typeof GroupCategories]

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

// export type ListUserGroupsParams = {
//     status?: GroupMemberStatuses
//     limit?: number
//     offset?: number
// }

// export type ListPendingGroupsParams = {
//     limit?: number
//     offset?: number
// }
