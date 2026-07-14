import * as React from 'react'
import { cn } from '../lib/cn'
import { Badge } from './Badge'
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
        <Card className={cn('space-y-4 p-4', className)}>
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    const formData = new FormData(e.currentTarget)
                    onSearch((formData.get(searchName) as string) || '')
                }}
            >
                <SearchInput name={searchName} defaultValue={searchValue} placeholder={searchPlaceholder} />
            </form>

            <div className="space-y-3">
                {groups.map((group, index) => (
                    <div key={group.title || index} className="flex flex-wrap items-center gap-2">
                        {group.title ? <span className="mr-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">{group.title}</span> : null}
                        {group.items.map((item) => (
                            <button key={item.key} type="button" onClick={item.onClick} className="coeer-focus rounded-full">
                                <Badge tone={item.active ? 'primary' : 'default'}>{item.label}</Badge>
                            </button>
                        ))}
                    </div>
                ))}
            </div>
        </Card>
    )
}
