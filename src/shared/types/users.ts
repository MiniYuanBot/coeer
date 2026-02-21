import { UserRole } from '@shared/constants';

// Basic user type (without sensitive info)
export interface User {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
}

// Public user info
export interface UserPublic {
    id: number;
    name: string | null;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
}

