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

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                {groups.map((group, index) => (
                    <React.Fragment key={group.title || index}>
                        {group.title ? (
                            <span className="hidden items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:flex">
                                {group.title}
                            </span>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                            {group.items.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={item.onClick}
                                    aria-pressed={item.active}
                                    className={cn(
                                        'coeer-focus shrink-0 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                                        item.active
                                            ? 'border-primary/30 bg-primary-soft font-medium text-primary'
                                            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                                    )}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        {index < groups.length - 1 ? (
                            <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
                        ) : null}
                    </React.Fragment>
                ))}
            </div>
        </Card>
    )
}
