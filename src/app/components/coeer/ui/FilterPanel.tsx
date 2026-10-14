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
    searchPlaceholder: string
    onSearch: (value: string) => void
    groups: Array<{ title?: string; items: FilterItem[] }>
    className?: string
}) {
    return (
        <section aria-label="搜索与筛选" className={cn('space-y-3 border-y border-border py-3.5', className)}>
            <form className="flex max-w-md gap-2" onSubmit={(e) => {
                e.preventDefault()
                onSearch(String(new FormData(e.currentTarget).get(searchName) || ''))
            }}>
                <SearchInput key={searchValue || ''} name={searchName} defaultValue={searchValue} placeholder={searchPlaceholder} />
                <button type="submit" aria-label="搜索" className="coeer-focus shrink-0 rounded-md border border-border px-3 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Icon name="search" />
                </button>
            </form>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                {groups.map((group, index) => (
                    <div key={group.title || index} role="group" aria-label={group.title || '筛选'} className="flex max-w-full flex-wrap items-center gap-1">
                        {group.title ? <span className="mr-1.5 text-xs text-muted-foreground">{group.title}</span> : null}
                        {group.items.map((item) => (
                            <button key={item.key} type="button" onClick={item.onClick} aria-pressed={item.active}
                                className={cn('coeer-focus min-h-8 rounded-md px-2.5 py-1 text-xs transition-colors',
                                    item.active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground')}>
                                {item.label}
                            </button>
                        ))}
                    </div>
                ))}
            </div>
        </section>
    )
}
