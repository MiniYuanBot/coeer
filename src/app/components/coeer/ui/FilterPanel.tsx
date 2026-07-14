import * as React from 'react'
import { cn } from '../lib/cn'
import { Card } from './Card'
import { SearchInput } from './SearchInput'

export type FilterItem = {
    key: string
    label: string
    active?: boolean
    onClick: () => void
}

export function FilterPanel({
    searchName = 'search',
    searchValue,
    searchPlaceholder,
    onSearch,
    groups,
    className,
}: {
    searchName?: string
    searchValue?: string
    searchPlaceholder: string
    onSearch: (value: string) => void
    groups: Array<{ title?: string; items: FilterItem[] }>
    className?: string
}) {
    return (
        <Card className={cn('space-y-4 rounded-xl p-4', className)}>
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    const formData = new FormData(e.currentTarget)
                    onSearch((formData.get(searchName) as string) || '')
                }}
            >
                <SearchInput name={searchName} defaultValue={searchValue} placeholder={searchPlaceholder} />
            </form>

            <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap">
                {groups.map((group, index) => (
                    <React.Fragment key={group.title || index}>
                        {group.items.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={item.onClick}
                                className={cn(
                                    'coeer-focus shrink-0 rounded-md border px-3 py-1.5 text-sm transition-colors',
                                    item.active
                                        ? 'border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--primary)/0.1)] font-medium text-[hsl(var(--primary))]'
                                        : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.35)] hover:text-[hsl(var(--foreground))]',
                                )}
                            >
                                {item.label}
                            </button>
                        ))}
                    </React.Fragment>
                ))}
            </div>
        </Card>
    )
}
