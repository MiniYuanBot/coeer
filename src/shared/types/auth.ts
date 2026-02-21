import { UserRole } from '@shared/constants';

export interface JWTPayload {
    userId: number;
    email: string;
    role: UserRole;
    sessionId: string;
    exp?: number;
    iat?: number;
}

export interface SessionData {
    id: string;
    userId: number;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    lastActiveAt?: Date;
    userAgent?: string;
    ipAddress?: string;
}

export interface AuthResponse {
    user: {
        id: number;
        email: string;
        name: string;
        role: string;
        avatarUrl?: string | null;
    };
    sessionId: string;
    expiresAt: string;
}