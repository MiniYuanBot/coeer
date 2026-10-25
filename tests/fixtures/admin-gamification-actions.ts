import { ownedCard } from './admin-gamification-router'

export const submitted = { action: '', data: {} as unknown }
export const failure = { mode: '' }
const save = (action: string) => async ({ data }: { data: unknown }) => {
    if (failure.mode === 'response') return { success: false, state: { message: '服务器拒绝保存' } }
    if (failure.mode === 'network') throw new Error('网络中断')
    submitted.action = action
    submitted.data = data
    window.dispatchEvent(new Event('admin-submitted'))
    return { success: true, state: { message: '保存成功' } }
}
export const adminCreateAchievementFn = save('createAchievement')
export const adminUpdateAchievementFn = save('updateAchievement')
export const adminDeleteAchievementFn = save('deleteAchievement')
export const adminCreateRedeemItemFn = save('createItem')
export const adminUpdateRedeemItemFn = save('updateItem')
export const adminDeleteRedeemItemFn = save('deleteItem')
export const adminCreateCardFn = save('createCard')
export const adminUpdateCardFn = save('updateCard')
export const adminDeleteCardFn = save('deleteCard')
export const getCardPoolFn = async () => ({ data: { items: [], total: 0 } })
export const getAllAchievementsFn = async () => ({ data: { items: [], total: 0 } })
export const adminListRedeemItemsFn = async () => ({ data: { items: [], total: 0 } })
export const adminListRedeemOrdersFn = async () => ({ data: { items: [], total: 0 } })
export const getMyCardsFn = async () => ({ data: { items: [ownedCard], total: 1 } })
export const drawCardsFn = async () => {
    ownedCard.count += 1
    return { cards: [{ ...ownedCard }], pointsSpent: 50 }
}
