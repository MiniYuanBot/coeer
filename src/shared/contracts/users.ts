import { z } from 'zod';
import { DbUser, UserProfile } from '~/database/schemas'
import { USER_ROLE_ARRAY } from '@shared/constants';
import { emailSchema, PaginationSchema } from './shared';

// ===== Zod Schemas ======

export const UserIdSchema = z.object({
    id: z.uuid(),
})

export const EmailSchema = z.object({
    email: emailSchema,
})

export const UpdateUserSchema = z.object({
    id: z.uuid(),
    name: z.string().min(1).max(200).optional(),
    passwordHash: z.string().min(50).max(60).optional(),
    role: z.enum(USER_ROLE_ARRAY).optional(),
    updatedAt: z.date().optional(),
})

export const UserFilterSchema = z.object({
    role: z.enum(USER_ROLE_ARRAY).optional(),
    search: z.string().optional(),
})

export const CountUsersSchema = z.object({
    id: z.uuid(),
    ...UserFilterSchema.shape,
})

export const ListUsersSchema = z.object({
    ...UserFilterSchema.shape,
    ...PaginationSchema.shape,
})

// export const UsersWithProfileSchema = z.object({
//     ...UserFilterSchema.shape,
//     ...PaginationSchema.shape,
// })

// ===== Typescript Types =====

// Types from Zod
export type UserIdInput = z.infer<typeof UserIdSchema>
export type EmailInput = z.infer<typeof EmailSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type UserFilterInput = z.infer<typeof UserFilterSchema>
export type CountUsersInput = z.infer<typeof CountUsersSchema>
export type ListUsersInput = z.infer<typeof ListUsersSchema>

export type User = Pick<DbUser, 'id' | 'email' | 'role' | 'createdAt' | 'name'>
export type UsersWithProfile = User & {
    profile: UserProfile | null;
}