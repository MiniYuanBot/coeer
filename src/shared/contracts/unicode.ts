import { z } from 'zod'
import { contentUnicodeError, usernameError } from '../unicode'

export const usernameSchema = z.string().superRefine((value, ctx) => {
    const message = usernameError(value)
    if (message) ctx.addIssue({ code: 'custom', message })
}).transform(value => value.normalize('NFKC'))

export function communityTextSchema(max: number, min = 1) {
    return z.string().min(min).max(max).superRefine((value, ctx) => {
        const message = contentUnicodeError(value)
        if (message) ctx.addIssue({ code: 'custom', message })
    })
}
