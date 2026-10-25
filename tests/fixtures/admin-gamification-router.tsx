import type { ComponentType } from 'react'
export { Link, useNavigate, useRouter } from './admin-navigation'
import { useNavigate, fixtureSearch } from './admin-navigation'

export const achievement = { id: '11111111-1111-4111-8111-111111111111', code: 'custom-days', name: '百日成就', description: '累计登录一百天', conditionType: 'login_days', conditionValue: 100, iconUrl: '/demo/card-common.svg' }
export const item = { id: '22222222-2222-4222-8222-222222222222', name: '纪念商品', description: '物品说明', pointsCost: 200, stock: 10, type: 'physical', status: 'discontinued', imageUrl: '/demo/bag.svg' }
export const card = { id: '33333333-3333-4333-8333-333333333333', name: '校园纪念卡', description: '卡片说明', rarity: 'rare' as const, series: '校园四季', dropRate: '0.3000', imageUrl: '/demo/card-rare.svg', createdAt: new Date() }
export const ownedCard = { id: '44444444-4444-4444-8444-444444444444', cardId: card.id, count: 2, card }
export function createFileRoute(path: string) {
    return (options: { component: ComponentType; validateSearch?: { parse: (value: unknown) => unknown } }) => ({
        options,
        useNavigate,
        useSearch: () => options.validateSearch?.parse(fixtureSearch()) ?? { page: 1 },
        useLoaderData: () => path === '/_authed/cards/' ? { items: [{ card, count: ownedCard.count }], total: 1, pageSize: 12 }
            : path === '/_authed/achievements/' ? { achievements: [{ ...achievement, unlocked: false }], total: 1, pageSize: 12 }
            : path.endsWith('/edit') ? path.includes('/cards/') ? card : path.includes('/achievements/') ? achievement : item
            : path.includes('/cards/') ? { cards: [card], total: 1 } : path.includes('/achievements/') ? { achievements: [achievement], total: 1 }
            : { items: [item], orders: [{ id: 'order-a', item, user: { id: 'user-a', name: '测试用户' }, quantity: 1, status: 'pending', createdAt: new Date() }], total: 1 },
    })
}
