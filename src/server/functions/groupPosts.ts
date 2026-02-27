import { createServerFn } from '@tanstack/react-start'
import { GroupPostService } from '../services/GroupPostService'
import {
    CreateGroupPostSchema,
    UpdateGroupPostSchema,
    TogglePinSchema,
} from '@shared/contracts'
import { GroupPostType, GROUP_POST_TYPE } from '@shared/constants'
import { z } from 'zod'

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
    .inputValidator((data: { id: string }) =>
        z.object({ id: z.uuid('Invalid post ID') }).parse(data)
    )
    .handler(async ({ data }) => {
        const result = await GroupPostService.getById(data.id)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// List posts by group (with pagination and type filter)
export const listGroupPostsFn = createServerFn({ method: 'GET' })
    .inputValidator((data: {
        groupId: string;
        type?: GroupPostType;
        page?: number;
        pageSize?: number;
    }) => z.object({
        groupId: z.uuid('Invalid group ID'),
        type: z.enum(GROUP_POST_TYPE).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(20),
    }).parse(data))
    .handler(async ({ data }) => {
        const result = await GroupPostService.listByGroup(data.groupId, {
            type: data.type,
            page: data.page,
            pageSize: data.pageSize,
        })

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// List posts by author across all groups
export const listPostsByAuthorFn = createServerFn({ method: 'GET' })
    .inputValidator((data: {
        authorId: string;
        page?: number;
        pageSize?: number;
    }) => z.object({
        authorId: z.uuid('Invalid author ID'),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(20),
    }).parse(data))
    .handler(async ({ data }) => {
        const result = await GroupPostService.listByAuthor(data.authorId, {
            page: data.page,
            pageSize: data.pageSize,
        })

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Update post (author or admin)
export const updateGroupPostFn = createServerFn({ method: 'POST' })
    .inputValidator((data: { id: string } & z.infer<typeof UpdateGroupPostSchema>) =>
        z.object({
            id: z.uuid('Invalid post ID'),
            title: z.string().min(1).max(200).optional(),
            content: z.string().min(1).max(10000).optional(),
        })
            .refine((val) => val.title !== undefined || val.content !== undefined, {
                message: 'At least one field (title or content) must be provided',
            })
            .parse(data)
    )
    .handler(async ({ data }) => {
        const { id, ...updateData } = data
        const result = await GroupPostService.update(id, updateData)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Delete post (author or admin, cascades reactions/replies)
export const deleteGroupPostFn = createServerFn({ method: 'POST' })
    .inputValidator((data: { id: string }) =>
        z.object({ id: z.uuid('Invalid post ID') }).parse(data)
    )
    .handler(async ({ data }) => {
        const result = await GroupPostService.delete(data.id)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Toggle pin status (admin only, with max limit)
export const togglePinPostFn = createServerFn({ method: 'POST' })
    .inputValidator(TogglePinSchema)
    .handler(async ({ data }) => {
        const { id, isPinned } = data
        const result = await GroupPostService.togglePin(id, isPinned)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Get announcements for a group
export const getAnnouncementsFn = createServerFn({ method: 'GET' })
    .inputValidator((data: {
        groupId: string;
        pageSize?: number;
    }) => z.object({
        groupId: z.uuid('Invalid group ID'),
        pageSize: z.number().min(1).max(20).default(10),
    }).parse(data))
    .handler(async ({ data }) => {
        const result = await GroupPostService.getAnnouncements(data.groupId, {
            pageSize: data.pageSize,
        })

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })