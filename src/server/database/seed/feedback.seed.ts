import { db } from '../client'
import { users } from '../schemas/users'
import { feedbacks, NewFeedback } from '../schemas'
import { eq, inArray, count, sql } from 'drizzle-orm'

const args = process.argv.slice(2)
const shouldClean = args.includes('--clean')

async function seedFeedbacks() {
    console.log('🌱 开始 seeding feedbacks 表...')

    try {
        // 测试数据库连接
        console.log('🔄 测试数据库连接...')
        await db.select().from(users).limit(1)
        console.log('✅ 数据库连接成功')

        // 获取现有的用户
        const existingUsers = await db.query.users.findMany({
            where: inArray(users.email, ['test@example.com', 'admin@example.com', 'demo@example.com'])
        })

        if (existingUsers.length === 0) {
            console.log('❌ 没有找到测试用户，请先运行用户种子脚本')
            process.exit(1)
        }

        // 查找各个角色的用户
        const testUser = existingUsers.find(u => u.email === 'test@example.com')
        const adminUser = existingUsers.find(u => u.email === 'admin@example.com')
        const demoUser = existingUsers.find(u => u.email === 'demo@example.com')

        if (!testUser || !adminUser) {
            console.log('❌ 缺少必要的测试用户')
            process.exit(1)
        }

        if (shouldClean) {
            console.log('🧹 检测到 --clean 参数，清空 feedbacks 表...')
            try {
                await db.delete(feedbacks)
                console.log('✅ feedbacks 表已清空')
            } catch (error) {
                console.error('❌ 清空表失败:', error)
                process.exit(1)
            }
        }

        // 检查是否已有反馈数据
        const existingFeedbacks = await db.select().from(feedbacks).limit(1)
        if (existingFeedbacks.length > 0 && !shouldClean) {
            console.log('⏭️ feedbacks 表已有数据，跳过创建（如需重新创建请使用 --clean 参数）')

            // 修正：使用 sql 模板字符串进行统计
            const stats = await db
                .select({
                    status: feedbacks.status,
                    count: sql<number>`count(*)`,
                })
                .from(feedbacks)
                .groupBy(feedbacks.status)

            console.log('\n📊 当前反馈数据统计:')
            stats.forEach(stat => {
                console.log(`  - ${stat.status}: ${stat.count} 条`)
            })

            process.exit(0)
        }

        // 创建测试反馈数据
        console.log('\n📝 创建测试反馈数据...')

        const sampleFeedbacks = [
            {
                authorId: testUser.id,
                targetType: 'academic' as const,
                targetDesc: '计算机学院教务办',
                title: '课程安排建议',
                content: '希望下学期能增加Python编程课的实践环节，现在的理论课太多，实践太少。建议每周增加2学时的实验课。',
                isAnonymous: false,
                status: 'pending' as const,
            },
            {
                authorId: testUser.id,
                targetType: 'office' as const,
                targetDesc: '学生事务办公室',
                title: '奖学金申请问题',
                content: '请问国家奖学金的申请截止日期是什么时候？需要准备哪些材料？另外，成绩单需要去哪里打印？',
                isAnonymous: true,
                status: 'processing' as const,
            },
            {
                authorId: demoUser?.id || testUser.id,
                targetType: 'general' as const,
                targetDesc: '校园网络',
                title: '宿舍网络不稳定',
                content: '最近一周12号宿舍楼网络经常断线，尤其是在晚上8-10点高峰期，严重影响学习和上网课。',
                isAnonymous: false,
                status: 'processing' as const,
            },
            {
                authorId: testUser.id,
                targetType: 'academic' as const,
                targetDesc: '图书馆',
                title: '延长开放时间建议',
                content: '考试周期间，建议图书馆延长开放时间到晚上12点，方便同学们复习。现在10点就关门太早了。',
                isAnonymous: false,
                status: 'resolved' as const,
                // adminReply: '感谢您的建议！经研究决定，考试周期间图书馆将开放到24:00，同时增加自习室座位。',
                resolvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前
            },
            {
                authorId: demoUser?.id || testUser.id,
                targetType: 'office' as const,
                targetDesc: '后勤处',
                title: '食堂菜品问题',
                content: '二食堂三楼的麻辣香锅太咸了，而且价格偏贵，希望能调整口味和价格。',
                isAnonymous: true,
                status: 'invalid' as const,
                // adminReply: '经核实，该窗口已暂停营业进行整改，建议您暂时去其他窗口就餐。',
                resolvedAt: new Date(),
            },
            {
                authorId: adminUser.id,
                targetType: 'general' as const,
                targetDesc: '校园环境',
                title: '建议增加垃圾桶',
                content: '操场周围垃圾桶太少，很多同学随手扔垃圾，建议每隔100米设置一个垃圾桶。',
                isAnonymous: false,
                status: 'pending' as const,
            },
            {
                authorId: testUser.id,
                targetType: 'academic' as const,
                targetDesc: '教务处',
                title: '选课系统问题',
                content: '选课系统在高峰期经常崩溃，建议优化服务器性能或者采用排队机制。',
                isAnonymous: false,
                status: 'processing' as const,
            },
            {
                authorId: demoUser?.id || testUser.id,
                targetType: 'office' as const,
                targetDesc: '宿管中心',
                title: '宿舍维修申请',
                content: '13号楼502室空调不制冷，已经报修一周了还没人来修，天气太热了。',
                isAnonymous: false,
                status: 'processing' as const,
            },
        ]

        console.log(`📊 准备创建 ${sampleFeedbacks.length} 条反馈数据...`)

        // 批量插入反馈
        for (const [index, fb] of sampleFeedbacks.entries()) {
            // 插入反馈
            const [feedback] = await db
                .insert(feedbacks)
                .values({
                    ...fb,
                    createdAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000),
                    updatedAt: new Date(),
                } as NewFeedback)
                .returning()

            console.log(`  ✅ 创建反馈 ${index + 1}/${sampleFeedbacks.length}: ${fb.title}`)
        }

        const allFeedbacks = await db.select().from(feedbacks)

        const statusStats = await db
            .select({
                status: feedbacks.status,
                count: sql<number>`count(*)`,
            })
            .from(feedbacks)
            .groupBy(feedbacks.status)

        const targetTypeStats = await db
            .select({
                targetType: feedbacks.targetType,
                count: sql<number>`count(*)`,
            })
            .from(feedbacks)
            .groupBy(feedbacks.targetType)

        console.log('\n📊 反馈数据统计:')
        console.log(`  📝 总反馈数: ${allFeedbacks.length} 条`)

        console.log('\n  📌 按状态分布:')
        statusStats.forEach(stat => {
            console.log(`    - ${stat.status}: ${stat.count} 条`)
        })

        console.log('\n  🎯 按目标类型分布:')
        targetTypeStats.forEach(stat => {
            const typeName = {
                academic: '学术/教学',
                office: '行政/办公室',
                general: '综合/其他'
            }[stat.targetType] || stat.targetType
            console.log(`    - ${typeName}: ${stat.count} 条`)
        })

        // 修正：使用 sql 模板字符串进行匿名统计
        const [anonymousResult] = await db
            .select({
                count: sql<number>`count(*)`
            })
            .from(feedbacks)
            .where(eq(feedbacks.isAnonymous, true))

        console.log(`\n  🕵️ 匿名反馈: ${anonymousResult?.count || 0} 条`)

        console.log('\n✅ Feedbacks seeding 完成!')

    } catch (error) {
        console.error('❌ Feedbacks seeding 失败:', error)
        process.exit(1)
    } finally {
        process.exit(0)
    }
}

// 运行 seed
seedFeedbacks()