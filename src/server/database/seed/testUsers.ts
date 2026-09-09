import { hashPassword } from '~/utils/password'
import { UserRole } from '@shared/constants'

export const testUsers = [
    {
        email: 'test@example.com',
        name: '林小测试',
        bio: '编程与桌游爱好者，正在攒积分换 COEER 周边。',
        passwordHash: await hashPassword('test1234'),
        role: 'student' as UserRole,
        isActive: true,
        createdAt: new Date(),
    },
    {
        email: 'admin@example.com',
        name: '平台管理员',
        bio: 'COEER 平台运营与内容审核。',
        passwordHash: await hashPassword('admin123'),
        role: 'admin' as UserRole,
        isActive: true,
        createdAt: new Date(),
    },
    {
        email: 'demo@example.com',
        name: '陈协管',
        bio: '宿舍与后勤反馈协管，负责线上意见跟进。',
        passwordHash: await hashPassword('demo1234'),
        role: 'moderator' as UserRole,
        isActive: true,
        createdAt: new Date(),
    },
]
