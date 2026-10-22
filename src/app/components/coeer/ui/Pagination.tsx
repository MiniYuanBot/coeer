import { Button } from './Button'
import { useEffect } from 'react'

export function Pagination({
    total,
    page,
    size = 10,
    onChange,
    label = '列表分页',
    disabled = false,
}: {
    total: number
    page: number
    size?: number
    onChange: (page: number) => void
    label?: string
    disabled?: boolean
}) {
    const pages = Math.max(1, Math.ceil(total / size))
    const currentPage = Math.min(Math.max(1, page), pages)
    useEffect(() => {
        if (!disabled && page !== currentPage) onChange(currentPage)
    }, [page, currentPage, disabled, onChange])
    return (
        <nav
            aria-label={label}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground"
        >
            <span aria-live="polite">
                {total ? `${(currentPage - 1) * size + 1}–${Math.min(currentPage * size, total)}` : '0'} / 共 {total} 条
            </span>
            <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" disabled={disabled || currentPage <= 1} onClick={() => onChange(currentPage - 1)}>
                    上一页
                </Button>
                <span className="tabular-nums">
                    {currentPage} / {pages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled || currentPage >= pages}
                    onClick={() => onChange(currentPage + 1)}
                >
                    下一页
                </Button>
            </div>
        </nav>
    )
}
