import type { ComponentType } from 'react'

export const achievement = { id: '11111111-1111-4111-8111-111111111111', code: 'custom-days', name: '百日成就', description: '累计登录一百天', conditionType: 'login_days', conditionValue: 100, iconUrl: '/demo/card-common.svg' }
export const item = { id: '22222222-2222-4222-8222-222222222222', name: '纪念商品', description: '物品说明', pointsCost: 200, stock: 10, type: 'physical', status: 'discontinued', imageUrl: '/demo/bag.svg' }
export function createFileRoute(path: string) {
    return (options: { component: ComponentType }) => ({
        options,
        useSearch: () => ({ page: 1 }),
        useLoaderData: () => path.endsWith('achievements') ? { achievements: [achievement], total: 1 } : { items: [item], total: 1 },
    })
}
export function useNavigate() { return async () => {} }
