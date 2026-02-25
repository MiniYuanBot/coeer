// server/fns/groups.ts
import { createServerFn } from '@tanstack/react-start'
import { GroupService } from '../services/GroupService'
import {
    CreateGroupSchema,
    UpdateGroupSchema,
    ApproveGroupSchema,
    JoinGroupSchema,
    // UpdateMemberRoleSchema
} from '@shared/contracts'
import { GroupCategories, GroupMemberRoles, GroupMemberStatuses } from '@shared/constants'
import { z } from 'zod'

// Create group
export const createGroupFn = createServerFn({ method: 'POST' })
    .inputValidator(CreateGroupSchema)
    .handler(async ({ data }) => {
        const result = await GroupService.create(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Get group by ID
export const getGroupByIdFn = createServerFn({ method: 'GET' })
    .inputValidator((data: { id: string }) => z.object({ id: z.string() }).parse(data))
    .handler(async ({ data }) => {
        const result = await GroupService.getById(data.id)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Get group by slug
export const getGroupBySlugFn = createServerFn({ method: 'GET' })
    .inputValidator((data: { slug: string }) => z.object({ slug: z.string() }).parse(data))
    .handler(async ({ data }) => {
        const result = await GroupService.getBySlug(data.slug)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Update group
export const updateGroupFn = createServerFn({ method: 'POST' })
    .inputValidator((data: { id: string } & z.infer<typeof UpdateGroupSchema>) =>
        z.object({
            id: z.string(),
            ...UpdateGroupSchema.shape
        }).parse(data)
    )
    .handler(async ({ data }) => {
        const { id, ...updateData } = data
        const result = await GroupService.update(id, updateData)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Delete group
export const deleteGroupFn = createServerFn({ method: 'POST' })
    .inputValidator((data: { id: string }) => z.object({ id: z.string() }).parse(data))
    .handler(async ({ data }) => {
        const result = await GroupService.delete(data.id)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// List public groups
export const listPublicGroupsFn = createServerFn({ method: 'GET' })
    .inputValidator((data: {
        category?: GroupCategories;
        search?: string;
        page?: number;
        pageSize?: number
    }) => data)
    .handler(async ({ data }) => {
        const result = await GroupService.listPublic({
            category: data.category,
            search: data.search,
            page: data.page || 1,
            pageSize: data.pageSize || 20,
        })

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// List my groups
export const listMyGroupsFn = createServerFn({ method: 'GET' })
    .inputValidator((data: {
        status?: GroupMemberStatuses;
        page?: number;
        pageSize?: number
    }) => data)
    .handler(async ({ data }) => {
        const result = await GroupService.listMyGroups({
            status: data.status,
            page: data.page || 1,
            pageSize: data.pageSize || 20,
        })

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// // List pending groups (admin)
// export const listPendingGroupsFn = createServerFn({ method: 'GET' })
//     .inputValidator((data: { page?: number; limit?: number }) => data)
//     .handler(async ({ data }) => {
//         const result = await GroupService.listPending({
//             page: data.page || 1,
//             limit: data.limit || 20,
//         })

//         if (!result.success) {
//             throw new Error(result.message)
//         }

//         return result.data
//     })

// // Approve/reject group (admin)
// export const approveGroupFn = createServerFn({ method: 'POST' })
//     .inputValidator(ApproveGroupSchema)
//     .handler(async ({ data }) => {
//         const { id, approved, rejectedReason } = data
//         const result = await GroupService.approveGroup(id, { approved, reason: rejectedReason })

//         if (!result.success) {
//             throw new Error(result.message)
//         }

//         return result.data
//     })

// Join group
export const joinGroupFn = createServerFn({ method: 'POST' })
    .inputValidator(JoinGroupSchema)
    .handler(async ({ data }) => {
        const result = await GroupService.joinGroup(data.groupId)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Leave group
export const leaveGroupFn = createServerFn({ method: 'POST' })
    .inputValidator((data: { groupId: string }) => z.object({ groupId: z.string() }).parse(data))
    .handler(async ({ data }) => {
        const result = await GroupService.leaveGroup(data.groupId)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Get group members
export const getGroupMembersFn = createServerFn({ method: 'GET' })
    .inputValidator((data: {
        groupId: string;
        status?: GroupMemberStatuses;
        role?: GroupMemberRoles;
        page?: number;
        pageSize?: number
    }) => data)
    .handler(async ({ data }) => {
        const result = await GroupService.getMembers(data.groupId, {
            status: data.status,
            role: data.role,
            page: data.page || 1,
            pageSize: data.pageSize || 50,
        })

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// // Update member role (admin)
// export const updateMemberRoleFn = createServerFn({ method: 'PUT' })
//     .inputValidator(UpdateMemberRoleSchema)
//     .handler(async ({ data }) => {
//         const { memberId, role } = data
//         const result = await GroupService.updateMemberRole(memberId, role)

//         if (!result.success) {
//             throw new Error(result.message)
//         }

//         return result.data
//     })

// // Remove member (admin)
// export const removeMemberFn = createServerFn({ method: 'DELETE' })
//     .inputValidator((data: { memberId: string }) => z.object({ memberId: z.string() }).parse(data))
//     .handler(async ({ data }) => {
//         const result = await GroupService.removeMember(data.memberId)

//         if (!result.success) {
//             throw new Error(result.message)
//         }

//         return result.data
//     })

// // Approve member join request (admin)
// export const approveMemberFn = createServerFn({ method: 'PUT' })
//     .inputValidator((data: { memberId: string }) => z.object({ memberId: z.string() }).parse(data))
//     .handler(async ({ data }) => {
//         const result = await GroupService.approveMember(data.memberId)

//         if (!result.success) {
//             throw new Error(result.message)
//         }

//         return result.data
//     })