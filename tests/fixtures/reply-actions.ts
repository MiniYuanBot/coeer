import type { CreateReplyInput, ReplyListItem, ReplyWithAuthor, UpdateReplyInput } from '../../src/shared/contracts/replies'

export const state = {
    items: [] as ReplyWithAuthor[],
    lastParent: '',
    failNextLoad: false,
    created: 0,
}

function reply(id: string, parentId: string | null, content: string, name = '同学乙'): ReplyWithAuthor {
    return {
        id, parentId, content, userId: 'me', author: { id: 'me', name }, targetType: 'group_post', targetId: 'post',
        createdAt: new Date('2026-10-22T08:00:00Z'), updatedAt: new Date('2026-10-22T08:00:00Z'),
    }
}

export function initialize() {
    state.items = [reply('root', null, '先检查换元：$u=x^2$。', '同学甲'), reply('many', null, '另一段讨论，有较多并列回复。')]
    for (let depth = 1; depth <= 7; depth++) {
        state.items.push(reply(`level-${depth}`, depth === 1 ? 'root' : `level-${depth - 1}`, `第 ${depth + 1} 级的推导：$x_${depth}^2$。`))
    }
    for (let index = 0; index < 25; index++) state.items.push(reply(`sibling-${index}`, 'many', `并列回复 ${index + 1}`))
    state.created = 0
    state.lastParent = ''
    state.failNextLoad = false
}

function item(value: ReplyWithAuthor): ReplyListItem {
    return { ...value, childCount: state.items.filter((candidate) => candidate.parentId === value.id).length }
}

export function roots() { return state.items.filter((value) => !value.parentId).map(item) }

export function configureChronologyFixture() {
    for (const value of state.items) value.createdAt = new Date('2026-01-01T00:00:00Z')
    state.items.find((value) => value.id === 'many')!.createdAt = new Date('2026-01-03T00:00:00Z')
    state.items.find((value) => value.id === 'sibling-0')!.createdAt = new Date('2026-01-03T01:00:00Z')
    state.items.find((value) => value.id === 'sibling-1')!.createdAt = new Date('2026-01-03T03:00:00Z')
    state.items.find((value) => value.id === 'sibling-2')!.createdAt = new Date('2026-01-03T02:00:00Z')
    window.dispatchEvent(new Event('reload-replies'))
}

export async function listChildRepliesFn({ data }: { data: { parentId: string; limit: number; offset: number } }) {
    if (state.failNextLoad) {
        state.failNextLoad = false
        throw new Error('模拟网络中断')
    }
    const children = state.items.filter((value) => value.parentId === data.parentId)
    return { success: true, state: { code: 'GET_SUCCESS' }, data: {
        items: children.slice(data.offset, data.offset + data.limit).map(item), total: children.length,
    } }
}

export async function createReplyFn({ data }: { data: CreateReplyInput }) {
    const created = reply(`new-${++state.created}`, data.parentId ?? null, data.content)
    created.createdAt = new Date()
    created.updatedAt = created.createdAt
    state.items.unshift(created)
    state.lastParent = data.parentId ?? 'root'
    return { success: true, state: { code: 'CREATE_SUCCESS' }, data: created }
}

export async function updateReplyFn({ data }: { data: UpdateReplyInput }) {
    state.items = state.items.map((value) => value.id === data.id ? { ...value, content: data.content } : value)
    return { success: true, state: { code: 'UPDATE_SUCCESS' } }
}

export async function deleteReplyFn({ data }: { data: { id: string } }) {
    state.items = state.items.map((value) => value.id === data.id ? { ...value, content: '' } : value)
    return { success: true, state: { code: 'DELETE_SUCCESS' } }
}

export function useRouter() {
    return { invalidate: async () => { window.dispatchEvent(new Event('reload-replies')) } }
}
