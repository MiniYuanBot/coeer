import { z } from 'zod';
import { UserRole, AuthCode } from '../constants'
import { ActionResponse } from './action';

export const emailSchema = z.email('Please enter a valid email address')
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')

export const loginSchema = z.object({
    email: emailSchema,
    password: passwordSchema
});

export const signupSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    // name: z.string().min(1, 'Name must be at least 1 characters').max(50, 'Password must be at most 50 characters'),
    // studentId: z.string().optional(),
    // major: z.string().optional(),
    // grade: z.number().min(1).max(8).optional()
});

// export const passwordResetSchema = z.object({
//     email: emailSchema
// });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
// export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

export type SessionUser = {
    id: string
    email: string
    role: UserRole
    name: string | null
    lastUpdated: number
}

export type SessionUserResponse<T> = ActionResponse<T, AuthCode>
export type LoginResponse<T> = ActionResponse<T, AuthCode>
export type SignupResponse<T> = ActionResponse<T, AuthCode>
export type LogoutResponse<T> = ActionResponse<T, AuthCode>