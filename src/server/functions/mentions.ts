import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { MentionService } from '../services/MentionService'

export const getMentionCandidatesFn = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ groupId: z.uuid(), search: z.string().max(63).default('') }))
    .handler(({ data }) => MentionService.candidates(data))
