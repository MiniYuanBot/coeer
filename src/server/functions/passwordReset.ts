import { createServerFn } from '@tanstack/react-start'
import { requestPasswordResetSchema, resetPasswordSchema } from '@shared/contracts/auth'
import { PasswordResetService } from '../services/PasswordResetService'

export const requestPasswordResetFn = createServerFn({ method: 'POST' }).inputValidator(requestPasswordResetSchema)
    .handler(({ data }) => PasswordResetService.request(data))
export const resetPasswordFn = createServerFn({ method: 'POST' }).inputValidator(resetPasswordSchema)
    .handler(({ data }) => PasswordResetService.reset(data))
