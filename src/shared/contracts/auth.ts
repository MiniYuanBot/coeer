import { usernameSchema } from './unicode'
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
export const ADMIN_STUDENT_ID = '0000000000';
export const STUDENT_EMAIL_PATTERN = /^(?!0000000000@)\d{10}@stu\.pku\.edu\.cn$/;

export const signupSchema = z.object({
    email: emailSchema.regex(STUDENT_EMAIL_PATTERN, '请使用 10 位学号的学生邮箱；0000000000 为管理员保留学号'),
    password: passwordSchema.refine((value) => new TextEncoder().encode(value).length <= 72, '密码不能超过 72 字节'),
});

export function studentIdFromEmail(email: string): string | undefined {
    return STUDENT_EMAIL_PATTERN.test(email) ? email.slice(0, 10) : undefined;
}

/** The reserved display ID never replaces the account ID used for ownership. */
export function studentIdForUser(user: { role: string; email: string }): string | undefined {
    return user.role === 'admin' ? ADMIN_STUDENT_ID : studentIdFromEmail(user.email);
}

export const updateProfileSchema = z.object({
    name: usernameSchema,
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, '请输入当前密码'),
    newPassword: signupSchema.shape.password,
});

export const requestPasswordResetSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
    token: z.string().regex(/^[a-f0-9]{64}$/, '重置链接无效，请重新申请'),
    newPassword: signupSchema.shape.password,
});

// ===== Typescript Types =====

// Types from Zod
export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type SessionUser = Pick<DbUser, 'id' | 'email' | 'role' | 'name'> & { lastUpdated: number; studentId?: string; avatarUrl?: string | null }
// Kept inside the encrypted session cookie; never returned to the browser as user data.
export type AppSessionData = SessionUser & { passwordVersion: string }

export type SessionUserResponse<T> = ActionResponse<T, AuthCode>
export type LoginResponse<T> = ActionResponse<T, AuthCode>
export type SignupResponse<T> = ActionResponse<T, AuthCode>
export type LogoutResponse<T> = ActionResponse<T, AuthCode>
