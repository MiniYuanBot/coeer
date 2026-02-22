import { db } from '../client'
import { users } from '../schemas/users'
import { UserRole } from '@shared/constants'
import { eq } from 'drizzle-orm'
import { hashPassword } from '~/utils/password'


const args = process.argv.slice(2)
const shouldClean = args.includes('--clean')

async function seed() {
    console.log('🌱 开始 seeding 数据库...')

    try {
        // 测试数据库连接
        console.log('🔄 测试数据库连接...')
        await db.select().from(users).limit(1)
        console.log('✅ 数据库连接成功')

        if (shouldClean) {
            console.log('🧹 检测到 --clean 参数，清空 users 表...')
            try {
                await db.delete(users)  // 删除所有用户
                console.log('✅ users 表已清空')
            } catch (error) {
                console.error('❌ 清空表失败:', error)
                process.exit(1)
            }
        }

        // 创建测试用户
        console.log('\n👥 创建测试用户...')

        const testUsers = [
            {
                email: 'test@example.com',
                name: 'Test User',
                passwordHash: await hashPassword('test123'),
                role: 'student' as UserRole,
                isActive: true,
            },
            {
                email: 'admin@example.com',
                name: 'Admin User',
                passwordHash: await hashPassword('admin123'),
                role: 'admin' as UserRole,
                isActive: true,
            },
            {
                email: 'demo@example.com',
                name: 'Demo User',
                passwordHash: await hashPassword('demo123'),
                role: 'moderator' as UserRole,
                isActive: true,
            }
        ]

        for (const user of testUsers) {
            // 检查用户是否已存在
            const existingUser = await db.query.users.findFirst({
                where: eq(users.email, user.email)
            })

            if (!existingUser) {
                await db.insert(users).values({
                    ...user,
                    createdAt: new Date(),
                })
                console.log(`  ✅ 创建用户: ${user.email}`)
            } else {
                console.log(`  ⏭️ 用户已存在: ${user.email}`)
            }
        }

        // 显示所有用户（不显示密码）
        const allUsers = await db.select({
            email: users.email,
            name: users.name,
            isActive: users.isActive,
            createdAt: users.createdAt,
        }).from(users)

        console.log(`\n📊 数据库中共有 ${allUsers.length} 个用户:`)
        allUsers.forEach(user => {
            console.log(`  - ${user.email} (${user.name})`)
        })

        console.log('\n✅ Seeding 完成!')

    } catch (error) {
        console.error('❌ Seeding 失败:', error)
        process.exit(1)
    } finally {
        process.exit(0)
    }
}

// 运行 seed
seed()