import { hashPassword } from '~/utils/password'
import { UserRole } from '@shared/constants'


export const testUsers = [
    {
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: await hashPassword('test123'),
        role: 'student' as UserRole,
        isActive: true,
        createdAt: new Date(),
    },
    {
        email: 'admin@example.com',
        name: 'Admin User',
        passwordHash: await hashPassword('admin123'),
        role: 'admin' as UserRole,
        isActive: true,
        createdAt: new Date(),
    },
    {
        email: 'demo@example.com',
        name: 'Demo User',
        passwordHash: await hashPassword('demo123'),
        role: 'moderator' as UserRole,
        isActive: true,
        createdAt: new Date(),
    }
]