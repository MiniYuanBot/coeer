import { eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import {
    achievements,
    activities,
    activityParticipants,
    bulletins,
    cards,
    groups,
    pointTransactions,
    redeemItems,
    redeemOrders,
    userAchievements,
    userCards,
    userSubscriptions,
} from '../schemas'
import { getSeedUsers, hasCleanFlag, isMainModule, runSeedCli } from './seed-utils'

function isDefined<T>(value: T | false | null | undefined): value is T {
    return Boolean(value)
}

export async function seedGamification(options: { clean?: boolean } = {}) {
    const shouldClean = options.clean ?? hasCleanFlag()
    console.log('Start seeding activity, bulletin, card, achievement and redeem data...')

    const { testUser, adminUser, demoUser } = await getSeedUsers()

    if (shouldClean) {
        console.log('Detect --clean param, clean gamification data...')
        await db.delete(redeemOrders)
        await db.delete(redeemItems)
        await db.delete(userAchievements)
        await db.delete(achievements)
        await db.delete(userCards)
        await db.delete(cards)
        await db.delete(pointTransactions)
        await db.delete(activityParticipants)
        await db.delete(activities)
        await db.delete(userSubscriptions)
        await db.delete(bulletins)
    }

    const seededGroups = await db.query.groups.findMany({
        where: inArray(groups.slug, ['coeer-official', 'coding-study', 'campus-events']),
    })
    const officialGroup = seededGroups.find((group) => group.slug === 'coeer-official')
    const codingGroup = seededGroups.find((group) => group.slug === 'coding-study')

    const sampleActivities = [
        {
            title: 'COEER 功能体验会',
            description: '面向核心用户演示反馈、群组、积分与商城流程。',
            type: 'official' as const,
            organizerType: 'user' as const,
            organizerId: adminUser.id,
            location: '创新中心 A101',
            startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
            maxParticipants: 80,
            status: 'upcoming' as const,
        },
        {
            title: '编程学习小组周末 Hack Night',
            description: '围绕校园工具做一个小型协作开发夜。',
            type: 'group' as const,
            organizerType: 'group' as const,
            organizerId: codingGroup?.id ?? adminUser.id,
            location: '线上会议室',
            startTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
            maxParticipants: 30,
            status: 'upcoming' as const,
        },
        {
            title: '校园问题共创圆桌',
            description: '围绕高频反馈讨论可执行的改进方案。',
            type: 'official' as const,
            organizerType: 'user' as const,
            organizerId: demoUser.id,
            location: '学生事务中心 B203',
            startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
            maxParticipants: 40,
            status: 'completed' as const,
        },
    ]

    for (const activity of sampleActivities) {
        const existing = await db.query.activities.findFirst({
            where: (table, { eq }) => eq(table.title, activity.title),
        })
        if (!existing) {
            await db.insert(activities).values(activity)
            console.log(`Create activity: ${activity.title}`)
        }
    }

    const seededActivities = await db.query.activities.findMany({
        where: inArray(activities.title, sampleActivities.map((activity) => activity.title)),
    })

    for (const activity of seededActivities) {
        for (const participant of [
            { activityId: activity.id, userId: testUser.id, status: 'registered' as const },
            { activityId: activity.id, userId: demoUser.id, status: activity.status === 'completed' ? 'attended' as const : 'registered' as const },
        ]) {
            const existing = await db.query.activityParticipants.findFirst({
                where: (table, { and, eq }) => and(eq(table.activityId, participant.activityId), eq(table.userId, participant.userId)),
            })
            if (!existing) await db.insert(activityParticipants).values(participant)
        }
    }

    const sampleCards = [
        { name: '工程馆晨光', description: '普通纪念卡', imageUrl: 'https://placehold.co/512x512?text=COEER+Common', rarity: 'common' as const, series: 'campus', dropRate: '0.6000' },
        { name: '代码夜航', description: '稀有学习卡', imageUrl: 'https://placehold.co/512x512?text=COEER+Rare', rarity: 'rare' as const, series: 'study', dropRate: '0.3000' },
        { name: '年度共创者', description: '传说贡献卡', imageUrl: 'https://placehold.co/512x512?text=COEER+Legendary', rarity: 'legendary' as const, series: 'honor', dropRate: '0.1000' },
    ]

    for (const card of sampleCards) {
        const existing = await db.query.cards.findFirst({ where: (table, { eq }) => eq(table.name, card.name) })
        if (!existing) {
            await db.insert(cards).values(card)
            console.log(`Create card: ${card.name}`)
        }
    }

    const seededCards = await db.query.cards.findMany({
        where: inArray(cards.name, sampleCards.map((card) => card.name)),
    })

    for (const [index, card] of seededCards.entries()) {
        const owner = index % 2 === 0 ? testUser : demoUser
        const existing = await db.query.userCards.findFirst({
            where: (table, { and, eq }) => and(eq(table.userId, owner.id), eq(table.cardId, card.id)),
        })
        if (!existing) await db.insert(userCards).values({ userId: owner.id, cardId: card.id, count: index + 1 })
    }

    const sampleAchievements = [
        { code: 'FIRST_FEEDBACK', name: '初次发声', description: '提交第一条反馈', conditionType: 'action' as const, conditionValue: 1 },
        { code: 'GROUP_STARTER', name: '社群发起人', description: '创建或管理一个群组', conditionType: 'action' as const, conditionValue: 1 },
        { code: 'CARD_COLLECTOR', name: '卡片收藏家', description: '收集 3 张卡片', conditionType: 'count' as const, conditionValue: 3 },
    ]

    for (const achievement of sampleAchievements) {
        const existing = await db.query.achievements.findFirst({ where: (table, { eq }) => eq(table.code, achievement.code) })
        if (!existing) {
            await db.insert(achievements).values(achievement)
            console.log(`Create achievement: ${achievement.code}`)
        }
    }

    const seededAchievements = await db.query.achievements.findMany({
        where: inArray(achievements.code, sampleAchievements.map((achievement) => achievement.code)),
    })

    for (const achievement of seededAchievements.slice(0, 2)) {
        const existing = await db.query.userAchievements.findFirst({
            where: (table, { and, eq }) => and(eq(table.userId, testUser.id), eq(table.achievementId, achievement.id)),
        })
        if (!existing) await db.insert(userAchievements).values({ userId: testUser.id, achievementId: achievement.id })
    }

    const sampleItems = [
        { name: 'COEER 贴纸包', description: '实体周边贴纸一套', imageUrl: 'https://placehold.co/512x512?text=Sticker', pointsCost: 80, stock: 50, type: 'physical' as const, status: 'active' as const },
        { name: '活动优先报名券', description: '可用于热门活动优先报名', imageUrl: 'https://placehold.co/512x512?text=Ticket', pointsCost: 200, stock: -1, type: 'virtual' as const, status: 'active' as const },
        { name: '限定帆布袋', description: '测试售罄商品', imageUrl: 'https://placehold.co/512x512?text=Bag', pointsCost: 500, stock: 0, type: 'physical' as const, status: 'sold_out' as const },
    ]

    for (const item of sampleItems) {
        const existing = await db.query.redeemItems.findFirst({ where: (table, { eq }) => eq(table.name, item.name) })
        if (!existing) {
            await db.insert(redeemItems).values(item)
            console.log(`Create redeem item: ${item.name}`)
        }
    }

    const seededItems = await db.query.redeemItems.findMany({
        where: inArray(redeemItems.name, sampleItems.map((item) => item.name)),
    })

    const ticket = seededItems.find((item) => item.name === '活动优先报名券')
    if (ticket) {
        const existing = await db.query.redeemOrders.findFirst({
            where: (table, { and, eq }) => and(eq(table.userId, testUser.id), eq(table.itemId, ticket.id)),
        })
        if (!existing) {
            await db.insert(redeemOrders).values({
                userId: testUser.id,
                itemId: ticket.id,
                status: 'completed',
                redeemCode: 'COEER-DEMO-2026',
                completedAt: new Date(),
            })
        }
    }

    const samplePointTransactions = [
        { userId: testUser.id, amount: 300, type: 'earn' as const, source: 'feedback' as const, description: 'Seed: resolved feedback reward' },
        { userId: testUser.id, amount: -50, type: 'spend' as const, source: 'draw' as const, description: 'Seed: card draw demo' },
        { userId: demoUser.id, amount: 180, type: 'earn' as const, source: 'activity' as const, description: 'Seed: activity participation reward' },
    ]

    for (const transaction of samplePointTransactions) {
        const existing = await db.query.pointTransactions.findFirst({
            where: (table, { and, eq }) => and(eq(table.userId, transaction.userId), eq(table.description, transaction.description)),
        })
        if (!existing) await db.insert(pointTransactions).values(transaction)
    }

    const sampleBulletins = [
        {
            type: 'official' as const,
            title: 'COEER 测试数据已更新',
            content: '活动、公告、卡片、成就和商城测试数据已经可用。',
            isPinned: true,
        },
        officialGroup && {
            type: 'group_announcement' as const,
            title: '官方公告群开放订阅',
            content: '订阅后可以在公告流中看到平台更新。',
            sourceId: officialGroup.id,
            sourceType: 'group_post' as const,
            isPinned: false,
        },
        seededActivities[0] && {
            type: 'activity' as const,
            title: seededActivities[0].title,
            content: seededActivities[0].description,
            sourceId: seededActivities[0].id,
            sourceType: 'activity' as const,
            isPinned: false,
        },
    ].filter(isDefined)

    for (const bulletin of sampleBulletins) {
        const existing = await db.query.bulletins.findFirst({ where: (table, { eq }) => eq(table.title, bulletin.title) })
        if (!existing) {
            await db.insert(bulletins).values(bulletin)
            console.log(`Create bulletin: ${bulletin.title}`)
        }
    }

    if (officialGroup) {
        const existing = await db.query.userSubscriptions.findFirst({
            where: (table, { and, eq }) => and(eq(table.userId, testUser.id), eq(table.targetType, 'group'), eq(table.targetId, officialGroup.id)),
        })
        if (!existing) {
            await db.insert(userSubscriptions).values({
                userId: testUser.id,
                targetType: 'group',
                targetId: officialGroup.id,
                isActive: true,
            })
        }
    }

    console.log('Gamification seeding succeeded')
}

if (isMainModule(import.meta.url)) {
    runSeedCli('Gamification', ({ clean }) => seedGamification({ clean }))
}
