/** Preserve the input and the thread hierarchy; sort each level by publication time. */
export function newestRepliesFirst<T extends { id: string; createdAt: Date | string }>(items: readonly T[]): T[] {
    return [...items].sort((left, right) => {
        const difference = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        if (difference) return difference
        return left.id < right.id ? 1 : left.id > right.id ? -1 : 0
    })
}
