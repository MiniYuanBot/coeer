import { createServerFn } from '@tanstack/react-start'
import { GroupService } from '../services/GroupService'
import {
    CreateGroupSchema,
    ApproveGroupSchema,
    GroupSlugSchema,
    GroupIdSchema,
    ListMyGroupsSchema,
    CheckRoleSchema,
    UpdateGroupSchema,
    ListAllGroupsSchema,
    ListMembersByGroupSchema,
    UpdateGroupMemberSchema,
    GroupMemberIdSchema,
} from '@shared/contracts'

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

// Get group by slug
export const getGroupBySlugFn = createServerFn({ method: 'GET' })
    .inputValidator(GroupSlugSchema)
    .handler(async ({ data }) => {
        const result = await GroupService.getBySlug(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Update group
export const updateGroupFn = createServerFn({ method: 'POST' })
    .inputValidator(UpdateGroupSchema)
    .handler(async ({ data }) => {
        const result = await GroupService.update(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Delete group
export const deleteGroupFn = createServerFn({ method: 'POST' })
    .inputValidator(GroupIdSchema)
    .handler(async ({ data }) => {
        const result = await GroupService.delete(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// List all groups
export const listAllGroupsFn = createServerFn({ method: 'GET' })
    .inputValidator(ListAllGroupsSchema)
    .handler(async ({ data }) => {
        const result = await GroupService.listAllGroups(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// List my groups
export const listMyGroupsFn = createServerFn({ method: 'GET' })
    .inputValidator(ListMyGroupsSchema)
    .handler(async ({ data }) => {
        const result = await GroupService.listMyGroups(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Approve/reject group (admin)
export const approveGroupFn = createServerFn({ method: 'POST' })
    .inputValidator(ApproveGroupSchema)
    .handler(async ({ data }) => {
        const result = await GroupService.approveGroup(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Join group
export const joinGroupFn = createServerFn({ method: 'POST' })
    .inputValidator(GroupIdSchema)
    .handler(async ({ data }) => {
        const result = await GroupService.joinGroup(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Leave group
export const leaveGroupFn = createServerFn({ method: 'POST' })
    .inputValidator(GroupIdSchema)
    .handler(async ({ data }) => {
        const result = await GroupService.leaveGroup(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Get group members
export const getGroupMembersFn = createServerFn({ method: 'GET' })
    .inputValidator(ListMembersByGroupSchema)
    .handler(async ({ data }) => {
        const result = await GroupService.getMembers(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Judge admin or not
export const checkRoleFn = createServerFn({ method: 'GET' })
    .inputValidator(CheckRoleSchema)
    .handler(async ({ data }) => {
        return GroupService.checkRole(data)
    })

// Update member role (admin)
export const updateMemberRoleFn = createServerFn({ method: 'POST' })
    .inputValidator(UpdateGroupMemberSchema)
    .handler(async ({ data }) => {
        const result = await GroupService.updateMember(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Remove member (admin)
export const removeMemberFn = createServerFn({ method: 'POST' })
    .inputValidator(GroupMemberIdSchema)
    .handler(async ({ data }) => {
        const result = await GroupService.removeMember(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })
