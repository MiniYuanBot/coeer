import type { ComponentType } from 'react'

export const achievement = { id: '11111111-1111-4111-8111-111111111111', code: 'custom-days', name: '百日成就', description: '累计登录一百天', conditionType: 'login_days', conditionValue: 100, iconUrl: '/demo/card-common.svg' }
export const item = { id: '22222222-2222-4222-8222-222222222222', name: '纪念商品', description: '物品说明', pointsCost: 200, stock: 10, type: 'physical', status: 'discontinued', imageUrl: '/demo/bag.svg' }
export const card = { id: '33333333-3333-4333-8333-333333333333', name: '校园纪念卡', description: '卡片说明', rarity: 'rare' as const, series: '校园四季', dropRate: '0.3000', imageUrl: '/demo/card-rare.svg', createdAt: new Date() }
export const ownedCard = { id: '44444444-4444-4444-8444-444444444444', cardId: card.id, count: 2, card }
export function createFileRoute(path: string) {
    return (options: { component: ComponentType }) => ({
        options,
        useNavigate,
        useSearch: () => ({ page: 1, view: 'cards' }),
        useLoaderData: () => path === '/_authed/achievements/' ? { myCards: [ownedCard], achievements: [], total: 1, pageSize: 12 }
            : path.endsWith('cards') ? { cards: [card], total: 1 } : path.endsWith('achievements') ? { achievements: [achievement], total: 1 } : { items: [item], total: 1 },
    })
}
export function useNavigate() { return async () => {} }
export function useRouter() { return { invalidate: async () => {} } }
