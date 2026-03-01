import { createServerFn } from '@tanstack/react-start'
import { GroupPostService } from '../services/GroupPostService'
import {
    CreateGroupPostSchema,
    UpdateGroupPostSchema,
    TogglePinSchema,
    GroupPostIdSchema,
    ListPostsByGroupSchema,
    ListPostsByAuthorSchema,
} from '@shared/contracts'

// Create a new post
export const createGroupPostFn = createServerFn({ method: 'POST' })
    .inputValidator(CreateGroupPostSchema)
    .handler(async ({ data }) => {
        const result = await GroupPostService.create(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Get post by ID with author info
export const getGroupPostByIdFn = createServerFn({ method: 'GET' })
    .inputValidator(GroupPostIdSchema)
    .handler(async ({ data }) => {
        const result = await GroupPostService.getById(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// List posts by group (with pagination and type filter)
export const listPostsByGroupFn = createServerFn({ method: 'GET' })
    .inputValidator(ListPostsByGroupSchema)
    .handler(async ({ data }) => {
        const result = await GroupPostService.listByGroup(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// List posts by author across all groups
export const listPostsByAuthorFn = createServerFn({ method: 'GET' })
    .inputValidator(ListPostsByAuthorSchema)
    .handler(async ({ data }) => {
        const result = await GroupPostService.listByAuthor(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Update post (author or admin)
export const updateGroupPostFn = createServerFn({ method: 'POST' })
    .inputValidator(UpdateGroupPostSchema)
    .handler(async ({ data }) => {
        const result = await GroupPostService.update(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Delete post (author or admin, cascades reactions/replies)
export const deleteGroupPostFn = createServerFn({ method: 'POST' })
    .inputValidator(GroupPostIdSchema)
    .handler(async ({ data }) => {
        const result = await GroupPostService.delete(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Toggle pin status (admin only, with max limit)
export const togglePinPostFn = createServerFn({ method: 'POST' })
    .inputValidator(TogglePinSchema)
    .handler(async ({ data }) => {
        const result = await GroupPostService.togglePin(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })
