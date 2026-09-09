import { eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import { groupMembers, groupPosts, groups } from '../schemas'
import { getSeedUsers, hasCleanFlag, isMainModule, runSeedCli } from './seed-utils'

function isDefined<T>(value: T | false | null | undefined): value is T {
    return Boolean(value)
}

export async function seedCommunity(options: { clean?: boolean } = {}) {
    const shouldClean = options.clean ?? hasCleanFlag()
    console.log('Start seeding community data...')

    const { testUser, adminUser, demoUser } = await getSeedUsers()

    if (shouldClean) {
        console.log('Detect --clean param, clean community data...')
        await db.delete(groupPosts)
        await db.delete(groupMembers)
        await db.delete(groups)
    }

    const sampleGroups = [
        {
            name: 'COEER 官方公告',
            slug: 'coeer-official',
            description: '平台官方通知、功能更新和重要说明。',
            category: 'organization' as const,
            creatorId: adminUser.id,
            status: 'approved' as const,
            isPublic: true,
            // 谁可以以什么身份出现在这个群（key = 自然身份，value = 预设成员状态）
            members: [
                { userId: adminUser.id, role: 'admin' as const, status: 'approved' as const },
                { userId: testUser.id, role: 'member' as const, status: 'approved' as const },
                { userId: demoUser.id, role: 'member' as const, status: 'approved' as const },
            ],
        },
        {
            name: '编程学习小组',
            slug: 'coding-study',
            description: '一起刷题、做项目、分享工程实践。',
            category: 'interest' as const,
            creatorId: demoUser.id,
            status: 'approved' as const,
            isPublic: true,
            members: [
                { userId: demoUser.id, role: 'admin' as const, status: 'approved' as const },
                { userId: testUser.id, role: 'member' as const, status: 'approved' as const },
                { userId: adminUser.id, role: 'member' as const, status: 'approved' as const },
            ],
        },
        {
            name: '校园活动筹备组',
            slug: 'campus-events',
            description: '活动策划、志愿者招募与现场执行协作。',
            category: 'project' as const,
            creatorId: testUser.id,
            status: 'pending' as const,
            isPublic: false,
            // 未审核的私密群：只有创建者可见（其它“已批准成员”是错的）
            members: [
                { userId: testUser.id, role: 'admin' as const, status: 'approved' as const },
            ],
        },
        {
            name: '读书分享会',
            slug: 'book-club',
            description: '每月共读一本书，线下或线上分享。私密群，成员由管理员审核。',
            category: 'interest' as const,
            creatorId: testUser.id,
            status: 'approved' as const,
            isPublic: false,
            members: [
                { userId: testUser.id, role: 'admin' as const, status: 'approved' as const },
                { userId: demoUser.id, role: 'member' as const, status: 'approved' as const },
                // 待审核申请：用于演示群管理员的“成员审核”流程
                { userId: adminUser.id, role: 'member' as const, status: 'pending' as const },
            ],
        },
    ]

    for (const group of sampleGroups) {
        const existing = await db.query.groups.findFirst({ where: eq(groups.slug, group.slug) })
        if (!existing) {
            await db.insert(groups).values({
                name: group.name,
                slug: group.slug,
                description: group.description,
                category: group.category,
                creatorId: group.creatorId,
                status: group.status,
                isPublic: group.isPublic,
            })
            console.log(`Create group: ${group.slug}`)
        } else {
            console.log(`Group exists: ${group.slug}`)
        }
    }

    // Memberships（幂等）
    const seededGroups = await db.query.groups.findMany({
        where: inArray(groups.slug, sampleGroups.map((group) => group.slug)),
    })

    for (const group of seededGroups) {
        const preset = sampleGroups.find((item) => item.slug === group.slug)
        for (const member of preset?.members ?? []) {
            const existing = await db.query.groupMembers.findFirst({
                where: (table, { and, eq }) => and(eq(table.groupId, group.id), eq(table.userId, member.userId)),
            })
            if (!existing) {
                // joinedAt 有 notNull+defaultNow；对 pending 申请行不传让其用默认值即可
                await db.insert(groupMembers).values({
                    groupId: group.id,
                    userId: member.userId,
                    role: member.role,
                    status: member.status,
                })
                console.log(`  Add member ${member.userId === testUser.id ? 'test' : member.userId === adminUser.id ? 'admin' : 'demo'}: ${member.status} @ ${group.slug}`)
            }
        }
    }

    const officialGroup = seededGroups.find((group) => group.slug === 'coeer-official')
    const codingGroup = seededGroups.find((group) => group.slug === 'coding-study')
    const bookClub = seededGroups.find((group) => group.slug === 'book-club')

    const samplePosts = [
        officialGroup && {
            groupId: officialGroup.id,
            authorId: adminUser.id,
            title: 'COEER 测试环境说明',
            content: '当前环境用于开发测试，欢迎通过反馈系统提交问题。',
            type: 'announcement' as const,
            isPinned: true,
        },
        officialGroup && {
            groupId: officialGroup.id,
            authorId: adminUser.id,
            title: '积分与成就系统使用说明',
            content: '提交反馈、参与活动、发帖互动都会累积积分；积分可抽卡片，也能在积分商城兑换校园周边与权益。',
            type: 'announcement' as const,
            isPinned: false,
        },
        officialGroup && {
            groupId: officialGroup.id,
            authorId: demoUser.id,
            title: '九月校园活动日历上线',
            content: '功能体验会、Hack Night 与共创圆桌已排期，欢迎在活动页报名。',
            type: 'discussion' as const,
            isPinned: false,
        },
        officialGroup && {
            groupId: officialGroup.id,
            authorId: testUser.id,
            title: '新人报到：介绍一下自己',
            content: '第一次使用 COEER？来官方动态下打个招呼，介绍一下你的专业和兴趣吧。',
            type: 'discussion' as const,
            isPinned: false,
        },
        codingGroup && {
            groupId: codingGroup.id,
            authorId: demoUser.id,
            title: '本周算法练习：图搜索',
            content: '建议大家完成 BFS/DFS 基础题，并在周末分享思路。',
            type: 'discussion' as const,
            isPinned: false,
        },
        codingGroup && {
            groupId: codingGroup.id,
            authorId: testUser.id,
            title: '项目协作规范草案',
            content: '建议统一使用 feature 分支开发，PR 中说明测试结果。',
            type: 'discussion' as const,
            isPinned: false,
        },
        bookClub && {
            groupId: bookClub.id,
            authorId: demoUser.id,
            title: '第一期共读书目投票',
            content: '候选书目：《卡片笔记写作法》《事实》《置身事内》，欢迎大家投票并附理由。',
            type: 'discussion' as const,
            isPinned: false,
        },
    ].filter(isDefined)

    for (const post of samplePosts) {
        const existing = await db.query.groupPosts.findFirst({
            where: (table, { and, eq }) => and(eq(table.groupId, post.groupId), eq(table.title, post.title)),
        })
        if (!existing) {
            await db.insert(groupPosts).values(post)
            console.log(`Create post: ${post.title}`)
        }
    }

    console.log('Community seeding succeeded')
}

if (isMainModule(import.meta.url)) {
    runSeedCli('Community', ({ clean }) => seedCommunity({ clean }))
}
