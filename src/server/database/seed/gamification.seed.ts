import { eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import {
    achievements,
    activities,
    activityParticipants,
    bulletins,
    cards,
    groups,
    groupPosts,
    pointTransactions,
    reactions,
    redeemItems,
    redeemOrders,
    replies,
    userAchievements,
    userCards,
    userSubscriptions,
    notifications,
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
        await db.delete(replies)
        await db.delete(reactions)
        await db.delete(activityParticipants)
        await db.delete(activities)
        await db.delete(userSubscriptions)
        await db.delete(bulletins)
    }

    const seededGroups = await db.query.groups.findMany({
        where: inArray(groups.slug, ['coeer-official', 'coding-study', 'campus-events', 'book-club']),
    })
    const officialGroup = seededGroups.find((group) => group.slug === 'coeer-official')
    const codingGroup = seededGroups.find((group) => group.slug === 'coding-study')
    if (!codingGroup) throw new Error('Missing coding-study group. Run seed:community first.')

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
            organizerId: codingGroup.id,
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
            organizerId: adminUser.id,
            location: '学生事务中心 B203',
            startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
            maxParticipants: 40,
            status: 'completed' as const,
        },
        {
            title: '周末校园公益跑',
            description: '环校 5km 公益跑，配速自由，欢迎新手。',
            type: 'official' as const,
            organizerType: 'user' as const,
            organizerId: adminUser.id,
            location: '东操场集合',
            startTime: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
            maxParticipants: 60,
            status: 'upcoming' as const,
        },
        {
            title: '编程学习小组项目分享会',
            description: '分享校园工具项目的实现过程，交流开发经验。',
            type: 'group' as const,
            organizerType: 'group' as const,
            organizerId: codingGroup.id,
            location: '报告厅 201',
            startTime: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
            maxParticipants: 3,
            status: 'upcoming' as const,
        },
        {
            title: '开放学习室共学', description: '正在进行的共学活动，用于展示报名截止后的状态。',
            type: 'group' as const, organizerType: 'group' as const, organizerId: codingGroup.id,
            location: '学习室 B102', startTime: new Date(Date.now() - 3600000), endTime: new Date(Date.now() + 3600000),
            maxParticipants: 20, status: 'ongoing' as const,
        },
        {
            title: '户外交流活动（已取消）', description: '因天气原因取消，用于展示取消状态。',
            type: 'official' as const, organizerType: 'user' as const, organizerId: adminUser.id,
            location: '校园草坪', startTime: new Date(Date.now() + 86400000), endTime: new Date(Date.now() + 90000000),
            maxParticipants: 20, status: 'cancelled' as const,
        },
    ]

    for (const activity of sampleActivities) {
        if (activity.title === '编程学习小组项目分享会') {
            const legacy = await db.query.activities.findFirst({ where: (table, { and, eq }) => and(eq(table.title, '辩论社表演赛观摩'), eq(table.organizerId, codingGroup.id)) })
            const current = await db.query.activities.findFirst({ where: (table, { eq }) => eq(table.title, activity.title) })
            if (legacy && !current) await db.update(activities).set({ title: activity.title, description: activity.description, maxParticipants: activity.maxParticipants }).where(eq(activities.id, legacy.id))
        }
        const existing = await db.query.activities.findFirst({
            where: (table, { eq }) => eq(table.title, activity.title),
        })
        if (!existing) {
            await db.insert(activities).values(activity)
            console.log(`Create activity: ${activity.title}`)
        } else if (activity.type === 'official' && existing.organizerId === demoUser.id) {
            await db.update(activities).set({ organizerId: adminUser.id }).where(eq(activities.id, existing.id))
        }
    }

    const seededActivities = await db.query.activities.findMany({
        where: inArray(activities.title, sampleActivities.map((activity) => activity.title)),
    })

    // 报名数据：每个活动都有 test/demo 报名；进行中/未开始的活动再给 admin 也报一个名
    for (const activity of seededActivities) {
        if (activity.status === 'cancelled') continue
        const usersToRegister = [testUser, demoUser, adminUser].filter(
            (user) => !(activity.status === 'completed' && user.id === adminUser.id),
        )
        for (const user of usersToRegister) {
            const status = activity.status === 'completed'
                ? (user.id === demoUser.id ? 'attended' as const : 'registered' as const)
                : 'registered' as const
            const existing = await db.query.activityParticipants.findFirst({
                where: (table, { and, eq }) => and(eq(table.activityId, activity.id), eq(table.userId, user.id)),
            })
            if (!existing) {
                await db.insert(activityParticipants).values({ activityId: activity.id, userId: user.id, status })
            }
        }
    }

    const sampleCards = [
        { name: '工程馆晨光', description: '普通纪念卡', imageUrl: '/demo/card-common.svg', rarity: 'common' as const, series: 'campus', dropRate: '0.6000' },
        { name: '代码夜航', description: '稀有学习卡', imageUrl: '/demo/card-rare.svg', rarity: 'rare' as const, series: 'study', dropRate: '0.3000' },
        { name: '年度共创者', description: '传说贡献卡', imageUrl: '/demo/card-legendary.svg', rarity: 'legendary' as const, series: 'honor', dropRate: '0.1000' },
    ]

    for (const card of sampleCards) {
        const existing = await db.query.cards.findFirst({ where: (table, { eq }) => eq(table.name, card.name) })
        if (!existing) {
            await db.insert(cards).values(card)
            console.log(`Create card: ${card.name}`)
        } else if (existing.imageUrl?.startsWith('https://placehold.co/')) {
            await db.update(cards).set({ imageUrl: card.imageUrl }).where(eq(cards.id, existing.id))
        }
    }

    const seededCards = await db.query.cards.findMany({
        where: inArray(cards.name, sampleCards.map((card) => card.name)),
    })

    // 卡册：testUser 集齐 3 种（与 CARD_COLLECTOR 成就一致），demoUser 有一张普通卡
    const cardOwnership: Array<{ userId: string; cardId: string; count: number }> = []
    for (const card of seededCards) {
        cardOwnership.push({ userId: testUser.id, cardId: card.id, count: card.rarity === 'common' ? 2 : 1 })
        if (card.rarity === 'common') {
            cardOwnership.push({ userId: demoUser.id, cardId: card.id, count: 1 })
        }
    }
    for (const owned of cardOwnership) {
        const existing = await db.query.userCards.findFirst({
            where: (table, { and, eq }) => and(eq(table.userId, owned.userId), eq(table.cardId, owned.cardId)),
        })
        if (!existing) {
            await db.insert(userCards).values({ userId: owned.userId, cardId: owned.cardId, count: owned.count })
        }
    }

    const sampleAchievements = [
        { code: 'FIRST_FEEDBACK', name: '初次发声', description: '提交第一条反馈', conditionType: 'feedback_count' as const, conditionValue: 1 },
        { code: 'GROUP_STARTER', name: '社群发起人', description: '创建或管理一个群组', conditionType: 'group_count' as const, conditionValue: 1 },
        { code: 'CARD_COLLECTOR', name: '卡片收藏家', description: '收集 3 张不同卡片', conditionType: 'card_count' as const, conditionValue: 3 },
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

    const achievementOwnership: Array<{ userId: string; achievementId: string }> = []
    for (const achievement of seededAchievements) {
        // testUser：提交过反馈、创建过群组、集齐 3 种卡片 → 三个成就全部达成
        achievementOwnership.push({ userId: testUser.id, achievementId: achievement.id })
        // demoUser：是 coding-study 的创建者 → 解锁 GROUP_STARTER
        if (achievement.code === 'GROUP_STARTER') {
            achievementOwnership.push({ userId: demoUser.id, achievementId: achievement.id })
        }
    }
    for (const owned of achievementOwnership) {
        const existing = await db.query.userAchievements.findFirst({
            where: (table, { and, eq }) => and(eq(table.userId, owned.userId), eq(table.achievementId, owned.achievementId)),
        })
        if (!existing) {
            await db.insert(userAchievements).values(owned)
            console.log(`  Unlock achievement ${owned.userId === testUser.id ? 'test' : 'demo'}`)
        }
    }

    const sampleItems = [
        { name: 'COEER 贴纸包', description: '实体周边贴纸一套', imageUrl: '/demo/sticker.svg', pointsCost: 80, stock: 50, type: 'physical' as const, status: 'active' as const },
        { name: '活动优先报名券', description: '可用于热门活动优先报名', imageUrl: '/demo/ticket.svg', pointsCost: 200, stock: -1, type: 'virtual' as const, status: 'active' as const },
        { name: '限定帆布袋', description: '测试售罄商品', imageUrl: '/demo/bag.svg', pointsCost: 500, stock: 0, type: 'physical' as const, status: 'sold_out' as const },
    ]

    for (const item of sampleItems) {
        const existing = await db.query.redeemItems.findFirst({ where: (table, { eq }) => eq(table.name, item.name) })
        if (!existing) {
            await db.insert(redeemItems).values(item)
            console.log(`Create redeem item: ${item.name}`)
        } else if (existing.imageUrl?.startsWith('https://placehold.co/')) {
            await db.update(redeemItems).set({ imageUrl: item.imageUrl }).where(eq(redeemItems.id, existing.id))
        }
    }

    const seededItems = await db.query.redeemItems.findMany({
        where: inArray(redeemItems.name, sampleItems.map((item) => item.name)),
    })
    const sticker = seededItems.find((item) => item.name === 'COEER 贴纸包')
    const ticket = seededItems.find((item) => item.name === '活动优先报名券')

    /**
     * 订单与积分流水保持“自洽”：余额 = Σ(流水)。
     *   testUser: +400(反馈奖励) -200(兑换报名券·已完成) -50(抽卡) = 150
     *   demoUser: +300(活动奖励) -160(兑换贴纸包×2·待处理) = 140
     * 说明：余额型流水在增量重跑时会累计，请使用 `--clean` 重建保持一致。
     */
    const sampleOrders: Array<{ userId: string; itemId: string; quantity: number; status: 'pending' | 'completed'; redeemCode?: string }> = []
    if (ticket) {
        sampleOrders.push({ userId: testUser.id, itemId: ticket.id, quantity: 1, status: 'completed', redeemCode: 'COEER-DEMO-2026' })
    }
    if (sticker) {
        sampleOrders.push({ userId: demoUser.id, itemId: sticker.id, quantity: 2, status: 'pending' })
    }

    for (const order of sampleOrders) {
        const existing = await db.query.redeemOrders.findFirst({
            where: (table, { and, eq }) => and(eq(table.userId, order.userId), eq(table.itemId, order.itemId), eq(table.status, order.status)),
        })
        if (!existing) {
            await db.insert(redeemOrders).values({
                userId: order.userId,
                itemId: order.itemId,
                quantity: order.quantity,
                status: order.status,
                redeemCode: order.redeemCode,
                completedAt: order.status === 'completed' ? new Date() : null,
            })
            console.log(`Create redeem order: ${order.userId === testUser.id ? 'test' : 'demo'} -> ${order.status}`)
        }
    }

    const samplePointTransactions = [
        // testUser
        { userId: testUser.id, amount: 400, type: 'earn' as const, source: 'feedback' as const, description: '反馈闭环奖励（延长开放时间建议）' },
        { userId: testUser.id, amount: -200, type: 'spend' as const, source: 'redeem' as const, description: '兑换：活动优先报名券' },
        { userId: testUser.id, amount: -50, type: 'spend' as const, source: 'draw' as const, description: '抽卡：代码夜航' },
        // demoUser
        { userId: demoUser.id, amount: 300, type: 'earn' as const, source: 'activity' as const, description: '活动参与奖励（共创圆桌）' },
        { userId: demoUser.id, amount: -160, type: 'spend' as const, source: 'redeem' as const, description: '兑换：COEER 贴纸包 ×2' },
    ]

    for (const transaction of samplePointTransactions) {
        // Recognize the earlier fixture label so reruns do not credit the reward twice.
        if (transaction.source === 'feedback') {
            const legacy = await db.query.pointTransactions.findFirst({ where: (table, { and, eq }) => and(eq(table.userId, transaction.userId), eq(table.description, '反馈闭环奖励（4 条反馈处理完成）')) })
            if (legacy) {
                await db.update(pointTransactions).set({ description: transaction.description }).where(eq(pointTransactions.id, legacy.id))
                continue
            }
        }
        const existing = await db.query.pointTransactions.findFirst({
            where: (table, { and, eq }) => and(eq(table.userId, transaction.userId), eq(table.description, transaction.description)),
        })
        if (!existing) {
            await db.insert(pointTransactions).values(transaction)
        }
    }

    // 互动演示：公告帖/讨论帖点赞；回复功能暂不开放。
    const seededPosts = await db.query.groupPosts.findMany({
        where: inArray(groupPosts.title, ['COEER 测试环境说明', '项目协作规范草案', '第一期共读书目投票']),
    })
    const officialPost = seededPosts.find((post) => post.title === 'COEER 测试环境说明')
    const normPost = seededPosts.find((post) => post.title === '项目协作规范草案')

    const sampleReactions: Array<{ userId: string; targetType: 'group_post'; targetId: string }> = []
    if (officialPost) {
        sampleReactions.push({ userId: testUser.id, targetType: 'group_post', targetId: officialPost.id })
        sampleReactions.push({ userId: demoUser.id, targetType: 'group_post', targetId: officialPost.id })
    }
    if (normPost) {
        sampleReactions.push({ userId: testUser.id, targetType: 'group_post', targetId: normPost.id })
        sampleReactions.push({ userId: demoUser.id, targetType: 'group_post', targetId: normPost.id })
    }

    for (const reaction of sampleReactions) {
        const existing = await db.query.reactions.findFirst({
            where: (table, { and, eq }) => and(
                eq(table.userId, reaction.userId),
                eq(table.targetType, reaction.targetType),
                eq(table.targetId, reaction.targetId),
            ),
        })
        if (!existing) {
            await db.insert(reactions).values(reaction)
        }
    }

    const sampleBulletins = [
        {
            type: 'official' as const,
            title: 'COEER 测试数据已更新',
            content: '活动、公告、卡片、成就和商城测试数据已经可用。',
            isPinned: true,
        },
        {
            type: 'official' as const,
            title: '2026 秋季学期重要节点日历',
            content: '选课、考试周、假期与活动安排一览，已同步到公告流与订阅。',
            isPinned: true,
        },
        {
            type: 'official' as const,
            title: '新手指南：从反馈到积分',
            content: '三步玩转 COEER：提交反馈获得处理进展 → 参与活动累积积分 → 抽卡或兑换校园权益。',
            isPinned: false,
        },
        {
            type: 'official' as const,
            title: '功能预告：自定义群组头像',
            content: '后续版本将支持群组上传头像与横幅图，敬请期待。',
            isPinned: false,
        },
        officialGroup && officialPost && {
            type: 'group_announcement' as const,
            title: '官方公告群开放订阅',
            content: '订阅后可以在公告流中看到平台更新。',
            sourceId: officialPost.id,
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
        } else if (bulletin.sourceType === 'group_post' && existing.sourceId === officialGroup?.id) {
            await db.update(bulletins).set({ sourceId: bulletin.sourceId }).where(eq(bulletins.id, existing.id))
        }
    }

    // 订阅：testUser 订阅官方公告群，demoUser 订阅官方公告群
    if (officialGroup) {
        for (const user of [testUser, demoUser]) {
            const existing = await db.query.userSubscriptions.findFirst({
                where: (table, { and, eq }) => and(
                    eq(table.userId, user.id),
                    eq(table.targetType, 'group'),
                    eq(table.targetId, officialGroup.id),
                ),
            })
            if (!existing) {
                await db.insert(userSubscriptions).values({
                    userId: user.id,
                    targetType: 'group',
                    targetId: officialGroup.id,
                    isActive: true,
                })
            }
        }
    }

    const reviewedFeedback = await db.query.feedbacks.findFirst({ where: (table, { and, eq }) => and(eq(table.authorId, testUser.id), eq(table.status, 'resolved')) })
    const upcoming = seededActivities.find((activity) => activity.title === 'COEER 功能体验会')
    const sampleNotifications = [
        reviewedFeedback && { userId: testUser.id, type: 'feedback_status', title: '反馈处理进展', content: `你的反馈「${reviewedFeedback.title}」已解决。`, href: `/feedbacks/${reviewedFeedback.id}` },
        upcoming && { userId: testUser.id, type: 'activity_registration', title: '活动报名成功', content: `你已成功报名「${upcoming.title}」。`, href: `/activities/${upcoming.id}` },
        officialGroup && { userId: adminUser.id, type: 'group_review', title: '群组审核结果', content: `你创建的群组「${officialGroup.name}」已通过审核。`, href: `/groups/${officialGroup.slug}` },
    ].filter(isDefined)
    for (const notification of sampleNotifications) {
        const existing = await db.query.notifications.findFirst({ where: (table, { and, eq }) => and(eq(table.userId, notification.userId), eq(table.type, notification.type), eq(table.href, notification.href)) })
        if (!existing) await db.insert(notifications).values(notification)
    }

    console.log('Gamification seeding succeeded')
}

if (isMainModule(import.meta.url)) {
    runSeedCli('Gamification', ({ clean }) => seedGamification({ clean }))
}
