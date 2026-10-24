import * as React from 'react'
import { cn } from '../lib/cn'
import { SearchInput } from './SearchInput'
import { Icon } from './Icon'

export type FilterItem = { key: string; label: string; active?: boolean; onClick: () => void }

export function FilterPanel({
    searchName = 'search', searchValue, searchPlaceholder, onSearch, groups, className,
}: {
    searchName?: string
    searchValue?: string
    searchPlaceholder?: string
    onSearch?: (value: string) => void
    groups: Array<{ title?: string; items: FilterItem[] }>
    className?: string
}) {
    return (
        <section aria-label="搜索与筛选" className={cn('coeer-filter-panel', className)}>
            {onSearch && searchPlaceholder ? <form role="search" className="coeer-filter-search flex min-w-0 gap-1.5" onSubmit={(e) => {
                e.preventDefault()
                onSearch?.(String(new FormData(e.currentTarget).get(searchName) || ''))
            }}>
                <SearchInput key={searchValue || ''} name={searchName} defaultValue={searchValue} placeholder={searchPlaceholder} />
                <button type="submit" aria-label="执行搜索" title="执行搜索" className="coeer-focus coeer-search-submit grid h-9 w-9 shrink-0 place-items-center rounded-md border border-control-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Icon name="chevron" className="h-3.5 w-3.5" />
                </button>
            </form> : null}
            <div className="coeer-filter-groups flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
                {groups.map((group, index) => (
                    <div key={group.title || index} role="group" aria-label={group.title || '筛选'} className="flex max-w-full flex-wrap items-center gap-1">
                        {group.title ? <span className="mr-2 border-l-2 border-primary/50 pl-2 text-xs font-semibold tracking-wide text-foreground">{group.title}</span> : null}
                        {group.items.map((item) => (
                            <button key={item.key} type="button" onClick={item.onClick} aria-pressed={!!item.active}
                                className={cn('coeer-focus coeer-filter-option min-h-8 rounded-md border px-2.5 py-1 text-xs transition-colors',
                                    item.active ? 'border-border bg-muted font-medium text-foreground' : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground')}>
                                {item.label}
                            </button>
                        ))}
                    </div>
                ))}
            </div>
        </section>
    )
}
