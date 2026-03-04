import { z } from 'zod'
import type { DbUser, GroupMember } from '~/database/schemas'
import {
    GroupMemberCode,
    GROUP_MEMBER_ROLE_ARRAY,
    GROUP_MEMBER_STATUS_ARRAY,
} from '../constants'
import { GroupWithCreator } from './groups'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'

// ===== Zod Schemas ======

export const GroupMemberIdSchema = z.object({
    memberId: z.uuid(),
})

export const UpdateGroupMemberSchema = z.object({
    memberId: z.uuid(),
    status: z.enum(GROUP_MEMBER_STATUS_ARRAY),
    role: z.enum(GROUP_MEMBER_ROLE_ARRAY),
})

export const GroupMemberFilterSchema = z.object({
    status: z.enum(GROUP_MEMBER_STATUS_ARRAY).optional(),
    role: z.enum(GROUP_MEMBER_ROLE_ARRAY).optional(),
})

export const CountMembersByGroupSchema = z.object({
    groupId: z.string(),
    ...GroupMemberFilterSchema.shape
})

export const ListMembersByGroupSchema = z.object({
    ...CountMembersByGroupSchema.shape,
    ...PaginationSchema.shape
})

export const CountMembersByUserSchema = z.object({
    userId: z.string(),
    ...GroupMemberFilterSchema.shape
})

export const ListMembersByUserSchema = z.object({
    ...CountMembersByUserSchema.shape,
    ...PaginationSchema.shape
})

// ===== Typescript Types =====

// Types from Zod
export type GroupMemberIdInput = z.infer<typeof GroupMemberIdSchema>
export type UpdateGroupMemberInput = z.infer<typeof UpdateGroupMemberSchema>
export type GroupMemberFilterInput = z.infer<typeof GroupMemberFilterSchema>
export type CountMembersByGroupInput = z.infer<typeof CountMembersByGroupSchema>
export type ListMembersByGroupInput = z.infer<typeof ListMembersByGroupSchema>
export type CountMembersByUserInput = z.infer<typeof CountMembersByUserSchema>
export type ListMembersByUserInput = z.infer<typeof ListMembersByUserSchema>

// Group member with user info
export type GroupMemberWithUser = GroupMember & {
    user: Pick<DbUser, 'id' | 'name'>
}

// Group member with group info
export type GroupMemberWithGroup = GroupMember & {
    group: GroupWithCreator
}

// Response types
export type GroupMemberResponse<T> = ActionResponse<T, GroupMemberCode>
export type PaginatedGroupMemberResponse<T> = PaginatedActionResponse<T, GroupMemberCode>