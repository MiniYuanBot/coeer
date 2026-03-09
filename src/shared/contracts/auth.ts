import { z } from 'zod';
import { AuthCode } from '../constants'
import { DbUser } from '~/database/schemas'
import { emailSchema, passwordSchema, ActionResponse } from './shared';

// ===== Zod Schemas ======

export const loginSchema = z.object({
    email: emailSchema,
    password: passwordSchema
});

export const signupSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    redirectUrl: z.url().optional(),
    // name: z.string().min(1, 'Name must be at least 1 characters').max(50, 'Password must be at most 50 characters'),
    // studentId: z.string().optional(),
    // major: z.string().optional(),
    // grade: z.number().min(1).max(8).optional()
});

// ===== Typescript Types =====

// Types from Zod
export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type SessionUser = Pick<DbUser, 'id' | 'email' | 'role' | 'name'> & { lastUpdated: number, }

export type SessionUserResponse<T> = ActionResponse<T, AuthCode>
export type LoginResponse<T> = ActionResponse<T, AuthCode>
export type SignupResponse<T> = ActionResponse<T, AuthCode>
export type LogoutResponse<T> = ActionResponse<T, AuthCode>