import { cn } from '../lib/cn'
import { SearchInput } from './SearchInput'
import { Icon } from './Icon'
import { Select } from './Field'
import { ViewTabs } from './NavTabs'

export type FilterItem = { key: string; label: string; active?: boolean; onClick: () => void }
export type FilterGroup = { title?: string; items: FilterItem[] }

export function FilterPanel({
    searchName = 'search', searchValue, searchPlaceholder, onSearch, onSearchChange, groups, scope, onClear, className,
}: {
    searchName?: string
    searchValue?: string
    searchPlaceholder?: string
    onSearch?: (value: string) => void
    onSearchChange?: (value: string) => void
    groups: FilterGroup[]
    scope?: FilterGroup
    onClear?: () => void
    className?: string
}) {
    const hasFilters = !!searchValue || groups.some(group => group.items.findIndex(item => item.active) > 0)
    return (
        <section aria-label="搜索与筛选" className={cn('coeer-filter-panel', className)}>
            {scope ? <ViewTabs label={scope.title || '查看范围'} items={scope.items} /> : null}
            <div className="coeer-filter-toolbar">
            {onSearch && searchPlaceholder ? <form role="search" className="coeer-filter-search flex min-w-0 gap-1.5" onSubmit={(e) => {
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
            {groups.length ? <div className="coeer-filter-groups">
                {groups.map((group, index) => (
                    <div key={group.title || index} className="coeer-filter-group" data-long={group.items.length > 6 || undefined}>
                        <label className="coeer-filter-select text-xs text-muted-foreground">
                            <span className="coeer-filter-label">{group.title || '筛选'}</span>
                            <Select aria-label={group.title || '筛选'} value={group.items.find(item => item.active)?.key ?? group.items[0]?.key ?? ''}
                                onChange={event => group.items.find(item => item.key === event.target.value)?.onClick()}>
                                {group.items.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
                            </Select>
                        </label>
                        <div className="coeer-filter-options" role="group" aria-label={group.title || '筛选'}>
                        {group.title ? <span className="coeer-filter-label">{group.title}</span> : null}
                        {group.items.map((item) => (
                            <button key={item.key} type="button" onClick={item.onClick} aria-pressed={!!item.active}
                                className={cn('coeer-focus coeer-filter-option min-h-8 rounded-md border px-2.5 py-1 text-xs transition-colors',
                                    item.active ? 'border-border bg-muted font-medium text-foreground' : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground')}>
                                {item.label}
                            </button>
                        ))}
                        </div>
                    </div>
                ))}
            </div> : null}
            </div>
        </section>
    )
}
