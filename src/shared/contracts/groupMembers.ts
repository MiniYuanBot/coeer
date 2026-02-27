// contracts/groups.ts
import { z } from 'zod'
import type { DbUser, GroupMember } from '~/database/schemas'
import {
    GroupMemberCode,
    GROUP_MEMBER_ROLE_ARRAY
} from '../constants'
import { GroupWithCreator } from './groups'
import { ActionResponse, PaginatedActionResponse } from './action'

// Zod Schemas
export const UpdateGroupMemberRoleSchema = z.object({
    memberId: z.uuid(),
    role: z.enum(GROUP_MEMBER_ROLE_ARRAY),
})

// export const ApproveGroupSchema = z.object({
//     id: z.uuid(),
//     approved: z.boolean(),
//     rejectedReason: z.string().max(200).optional(),
// })

// // Types from Zod
// export type CreateGroupData = z.infer<typeof CreateGroupSchema>
// export type UpdateGroupData = z.infer<typeof UpdateGroupSchema>
// export type JoinGroupData = z.infer<typeof JoinGroupSchema>
// export type UpdateMemberRoleData = z.infer<typeof UpdateGroupMemberRoleSchema>
// export type ApproveGroupData = z.infer<typeof ApproveGroupSchema>

// Group member with user info
export type GroupMemberWithUser = GroupMember & {
    user: Pick<DbUser, 'id' | 'name'>
}

// Group member with group info
export type GroupMemberWithGroup = GroupMember & {
    group: GroupWithCreator
}

// export type ListUserGroupsParams = {
//     status?: GroupMemberStatuses
//     limit?: number
//     offset?: number
// }

// export type ListGroupMembersParams = {
//     status?: GroupMemberStatuses
//     role?: GroupMemberRoles
//     limit?: number
//     offset?: number
// }

// export type ListPendingGroupsParams = {
//     limit?: number
//     offset?: number
// }

// Response types
export type GroupMemberResponse<T> = ActionResponse<T, GroupMemberCode>
export type PaginatedGroupMemberResponse<T> = PaginatedActionResponse<T, GroupMemberCode>