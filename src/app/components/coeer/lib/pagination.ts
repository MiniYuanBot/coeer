export function paginate<T>(items: T[], requested: number, size = 10) {
    const page = Math.min(Math.max(1, requested), Math.max(1, Math.ceil(items.length / size)))
    return { items: items.slice((page - 1) * size, page * size), total: items.length, page, size }
}
