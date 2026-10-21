import { Button } from './Button'

export function Pagination({
    total,
    page,
    size = 10,
    onChange,
    label = '列表分页',
}: {
    total: number
    page: number
    size?: number
    onChange: (page: number) => void
    label?: string
}) {
    const pages = Math.max(1, Math.ceil(total / size))
    return (
        <nav
            aria-label={label}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground"
        >
            <span aria-live="polite">
                {total ? `${(page - 1) * size + 1}–${Math.min(page * size, total)}` : '0'} / 共 {total} 条
            </span>
            <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
                    上一页
                </Button>
                <span className="tabular-nums">
                    {page} / {pages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pages}
                    onClick={() => onChange(page + 1)}
                >
                    下一页
                </Button>
            </div>
        </nav>
    )
}
