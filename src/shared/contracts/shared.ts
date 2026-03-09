import { z } from 'zod'

// ===== Zod Schemas ======

export const emailSchema = z.email('Please enter a valid email address')
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')
export const passwordHashSchema = z.string().min(50).max(60)

export const EntityIdSchema = z.object({
    id: z.uuid(),
})

export const PaginationSchema = z.object({
    limit: z.number().int().positive().default(20),
    offset: z.number().int().positive().default(0),
})

// ===== Typescript Types =====

// Types from Zod
export type EntityIdInput = z.infer<typeof EntityIdSchema>
export type PaginationInput = z.infer<typeof PaginationSchema>

// Base action state
export type ActionState<S extends string = string> = {
    code: S
    message?: string // user friendly message
}

// Define the response for server actions,
// like createServerFn / form action / etc
// Status is given string key
// like 'SUCCESS' / 'SERVER_ERROR'
export type ActionResponse<T = void, S extends string = string> = {
    success: boolean
    data?: T
    state: ActionState<S>
}

export type PaginatedData<T> = {
    items?: T[] // returning items
    total?: number // total items in the database
    limit?: number // query limit [pageSize]
    offset?: number // offset items [(currentPage-1) * pageSize]
}

// Response for paginated actions
export type PaginatedActionResponse<T, S extends string = string> = {
    success: boolean
    data?: PaginatedData<T>
    state: ActionState<S>
}
