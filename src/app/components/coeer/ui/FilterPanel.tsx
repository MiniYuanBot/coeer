import { cn } from '../lib/cn'
import { SearchInput } from './SearchInput'
import { Icon } from './Icon'
import { ViewTabs } from './NavTabs'

export type FilterItem = { key: string; label: string; active?: boolean; onClick: () => void }
export type FilterGroup = { title?: string; items: FilterItem[] }

export type FilterPanelProps = {
    searchName?: string
    searchValue?: string
    searchPlaceholder?: string
    onSearch?: (value: string) => void
    onSearchChange?: (value: string) => void
    groups?: FilterGroup[]
    scope?: FilterGroup
    onClear?: () => void
    className?: string
}

export function filterGroup<T extends string>(title: string, values: readonly T[], labels: Record<string, string>, active: T | undefined,
    onChange: (value: T | undefined) => void, allLabel = '全部类型'): FilterGroup {
    return { title, items: [
        { key: '', label: allLabel, active: !active, onClick: () => onChange(undefined) },
        ...values.map(value => ({ key: value, label: labels[value] || value, active: value === active, onClick: () => onChange(value) })),
    ] }
}

export function FilterPanel({
    searchName = 'search', searchValue, searchPlaceholder, onSearch, onSearchChange, groups = [], scope, onClear, className,
}: FilterPanelProps) {
    const hasFilters = !!searchValue || groups.some(group => group.items.findIndex(item => item.active) > 0)
    const hasSearch = !!onSearch && !!searchPlaceholder
    if (!scope && !hasSearch && !onClear && !groups.length) return null
    return (
        <section aria-label={hasSearch || groups.length || onClear ? '搜索与筛选' : scope?.title || '查看范围'} className={cn('coeer-filter-panel', className)}>
            {scope ? <ViewTabs label={scope.title || '查看范围'} items={scope.items} /> : null}
            {hasSearch || onClear ? <div className="coeer-filter-toolbar">
            {hasSearch ? <form role="search" className="coeer-filter-search flex min-w-0 gap-1.5" onSubmit={(e) => {
                e.preventDefault()
                onSearch?.(String(new FormData(e.currentTarget).get(searchName) || ''))
            }}>
                <SearchInput key={onSearchChange ? undefined : searchValue || ''} name={searchName}
                    {...(onSearchChange ? { value: searchValue ?? '', onChange: (event) => onSearchChange(event.target.value) } : { defaultValue: searchValue })}
                    placeholder={searchPlaceholder} />
                <button type="submit" aria-label="执行搜索" title="执行搜索" className="coeer-focus coeer-button-quiet coeer-search-submit grid h-9 w-9 shrink-0 place-items-center rounded-md border border-transparent text-foreground">
                    <Icon name="search" className="h-4 w-4" />
                </button>
            </form> : null}
            {onClear ? <button type="button" onClick={onClear} disabled={!hasFilters}
                className="coeer-focus coeer-filter-clear shrink-0 rounded px-1 text-xs text-primary hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline">清除筛选</button> : null}
            </div> : null}
            {groups.length ? <div className="coeer-filter-groups">
                {groups.map((group, index) => <FilterOptions key={group.title || index} {...group} />)}
            </div> : null}
        </section>
    )
}

/** Reusable labeled options; always separate from the search toolbar. */
export function FilterOptions({ title, items }: FilterGroup) {
    return <div className="coeer-filter-options" role="group" aria-label={title || '筛选'}>
        {title ? <span className="coeer-filter-label">{title}</span> : null}
        {items.map(item => <button key={item.key} type="button" onClick={item.onClick} aria-pressed={!!item.active}
            className={cn('coeer-focus coeer-filter-option min-h-11 rounded-md border px-2.5 py-1 text-xs transition-colors sm:min-h-8',
                item.active ? 'border-border bg-muted font-medium text-foreground' : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground')}>
            {item.label}
        </button>)}
    </div>
}
