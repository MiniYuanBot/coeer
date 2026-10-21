import { z } from 'zod';
import { AuthCode } from '../constants'
import { DbUser } from '~/database/schemas'
import { emailSchema, passwordSchema, ActionResponse } from './shared';

// ===== Zod Schemas ======

export const loginSchema = z.object({
    email: emailSchema,
    password: passwordSchema
});

// Only server-side provisioning may create administrators with another email domain.
export const STUDENT_EMAIL_PATTERN = /^\d{10}@stu\.pku\.edu\.cn$/;

export const signupSchema = z.object({
    email: emailSchema.regex(STUDENT_EMAIL_PATTERN, '请使用 10 位学号的 @stu.pku.edu.cn 学生邮箱'),
    password: passwordSchema.refine((value) => new TextEncoder().encode(value).length <= 72, '密码不能超过 72 字节'),
});

export function studentIdFromEmail(email: string): string | undefined {
    return STUDENT_EMAIL_PATTERN.test(email) ? email.slice(0, 10) : undefined;
}

export const updateProfileSchema = z.object({
    name: z.string().trim().min(1, '请输入昵称').max(63, '昵称不能超过 63 个字符'),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, '请输入当前密码'),
    newPassword: signupSchema.shape.password,
});

// ===== Typescript Types =====

// Types from Zod
export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type SessionUser = Pick<DbUser, 'id' | 'email' | 'role' | 'name'> & { lastUpdated: number, }
// Kept inside the encrypted session cookie; never returned to the browser as user data.
export type AppSessionData = SessionUser & { passwordVersion: string }

export type SessionUserResponse<T> = ActionResponse<T, AuthCode>
export type LoginResponse<T> = ActionResponse<T, AuthCode>
export type SignupResponse<T> = ActionResponse<T, AuthCode>
export type LogoutResponse<T> = ActionResponse<T, AuthCode>
