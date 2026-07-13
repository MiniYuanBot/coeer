import { createServerFn } from '@tanstack/react-start'
import {
    ActivityIdSchema,
    ActivityParticipantIdSchema,
    CreateActivitySchema,
    ListActivitiesSchema,
    ListActivityParticipantsSchema,
    RegisterActivitySchema,
    UpdateActivitySchema,
} from '@shared/contracts'
import { ActivityService } from '../services'

export const createActivityFn = createServerFn({ method: 'POST' })
    .inputValidator(CreateActivitySchema)
    .handler(async ({ data }) => ActivityService.create(data))

export const getActivityByIdFn = createServerFn({ method: 'GET' })
    .inputValidator(ActivityIdSchema)
    .handler(async ({ data }) => ActivityService.getById(data))

export const listActivitiesFn = createServerFn({ method: 'GET' })
    .inputValidator(ListActivitiesSchema)
    .handler(async ({ data }) => ActivityService.list(data))

export const updateActivityFn = createServerFn({ method: 'POST' })
    .inputValidator(UpdateActivitySchema)
    .handler(async ({ data }) => ActivityService.update(data))

export const deleteActivityFn = createServerFn({ method: 'POST' })
    .inputValidator(ActivityIdSchema)
    .handler(async ({ data }) => ActivityService.delete(data))

export const registerActivityFn = createServerFn({ method: 'POST' })
    .inputValidator(RegisterActivitySchema)
    .handler(async ({ data }) => ActivityService.register(data))

export const cancelRegistrationFn = createServerFn({ method: 'POST' })
    .inputValidator(ActivityParticipantIdSchema)
    .handler(async ({ data }) => ActivityService.cancelRegistration(data))

export const checkInActivityFn = createServerFn({ method: 'POST' })
    .inputValidator(ActivityParticipantIdSchema)
    .handler(async ({ data }) => ActivityService.checkIn(data))

export const getActivityParticipantsFn = createServerFn({ method: 'GET' })
    .inputValidator(ListActivityParticipantsSchema)
    .handler(async ({ data }) => ActivityService.listParticipants(data))

