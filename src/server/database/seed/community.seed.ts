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
        },
        {
            name: '编程学习小组',
            slug: 'coding-study',
            description: '一起刷题、做项目、分享工程实践。',
            category: 'interest' as const,
            creatorId: demoUser.id,
            status: 'approved' as const,
            isPublic: true,
        },
        {
            name: '校园活动筹备组',
            slug: 'campus-events',
            description: '活动策划、志愿者招募与现场执行协作。',
            category: 'project' as const,
            creatorId: testUser.id,
            status: 'pending' as const,
            isPublic: false,
        },
    ]

    for (const group of sampleGroups) {
        const existing = await db.query.groups.findFirst({ where: eq(groups.slug, group.slug) })
        if (!existing) {
            await db.insert(groups).values(group)
            console.log(`Create group: ${group.slug}`)
        } else {
            console.log(`Group exists: ${group.slug}`)
        }
    }

    const seededGroups = await db.query.groups.findMany({
        where: inArray(groups.slug, sampleGroups.map((group) => group.slug)),
    })

    for (const group of seededGroups) {
        const members = [
            { groupId: group.id, userId: group.creatorId ?? adminUser.id, role: 'admin' as const, status: 'approved' as const },
            { groupId: group.id, userId: testUser.id, role: 'member' as const, status: 'approved' as const },
            { groupId: group.id, userId: demoUser.id, role: 'member' as const, status: 'approved' as const },
        ]

        for (const member of members) {
            const existing = await db.query.groupMembers.findFirst({
                where: (table, { and, eq }) => and(eq(table.groupId, member.groupId), eq(table.userId, member.userId)),
            })
            if (!existing) {
                await db.insert(groupMembers).values(member)
            }
        }
    }

    const officialGroup = seededGroups.find((group) => group.slug === 'coeer-official')
    const codingGroup = seededGroups.find((group) => group.slug === 'coding-study')

    const samplePosts = [
        officialGroup && {
            groupId: officialGroup.id,
            authorId: adminUser.id,
            title: 'COEER 测试环境说明',
            content: '当前环境用于开发测试，欢迎通过反馈系统提交问题。',
            type: 'announcement' as const,
            isPinned: true,
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
