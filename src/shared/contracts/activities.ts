import { z } from 'zod'
import type { Activity, ActivityParticipant, DbUser, Group } from '~/database/schemas'
import {
    ActivityCode,
    ACTIVITY_STATUS_ARRAY,
    ACTIVITY_TYPE_ARRAY,
    ORGANIZER_TYPE_ARRAY,
    PARTICIPANT_STATUS_ARRAY,
} from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'

export const ActivityIdSchema = z.object({
    id: z.uuid(),
})

export const CreateActivitySchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    type: z.enum(ACTIVITY_TYPE_ARRAY),
    organizerType: z.enum(ORGANIZER_TYPE_ARRAY).optional(),
    organizerId: z.uuid().optional(),
    location: z.string().max(200).optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    maxParticipants: z.number().int().min(1).optional(),
})

export const UpdateActivitySchema = z.object({
    id: z.uuid(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(5000).optional(),
    location: z.string().max(200).optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    maxParticipants: z.number().int().min(1).optional(),
    status: z.enum(ACTIVITY_STATUS_ARRAY).optional(),
})

export const ListActivitiesSchema = z.object({
    type: z.enum(ACTIVITY_TYPE_ARRAY).optional(),
    organizerType: z.enum(ORGANIZER_TYPE_ARRAY).optional(),
    organizerId: z.uuid().optional(),
    status: z.enum(ACTIVITY_STATUS_ARRAY).optional(),
    search: z.string().optional(),
    ...PaginationSchema.shape,
})

export const ActivityParticipantIdSchema = z.object({
    participantId: z.uuid(),
})

export const RegisterActivitySchema = z.object({
    activityId: z.uuid(),
})

export const ListActivityParticipantsSchema = z.object({
    activityId: z.uuid(),
    status: z.enum(PARTICIPANT_STATUS_ARRAY).optional(),
    ...PaginationSchema.shape,
})

export type ActivityIdInput = z.infer<typeof ActivityIdSchema>
export type CreateActivityInput = z.infer<typeof CreateActivitySchema>
export type UpdateActivityInput = z.infer<typeof UpdateActivitySchema>
export type ListActivitiesInput = z.infer<typeof ListActivitiesSchema>
export type ActivityParticipantIdInput = z.infer<typeof ActivityParticipantIdSchema>
export type RegisterActivityInput = z.infer<typeof RegisterActivitySchema>
export type ListActivityParticipantsInput = z.infer<typeof ListActivityParticipantsSchema>

export type ActivityWithOrganizer = Activity & {
    organizer?: Pick<DbUser, 'id' | 'name'> | Pick<Group, 'id' | 'name' | 'slug'> | null
}

export type ActivityParticipantWithUser = ActivityParticipant & {
    user: Pick<DbUser, 'id' | 'name'> | null
}

export type ActivityParticipantWithActivity = ActivityParticipant & {
    activity: Activity
}

export type ActivityResponse<T> = ActionResponse<T, ActivityCode>
export type PaginatedActivityResponse<T> = PaginatedActionResponse<T, ActivityCode>
