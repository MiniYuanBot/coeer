import type { Key, ReactNode } from 'react'
import { Card } from './Card'
import { EmptyState } from './EmptyState'
import { TableScroll } from './TableScroll'

export type TableColumn<T> = {
    key: string
    header: string
    width?: string
    align?: 'left' | 'right'
    render: (row: T) => ReactNode
}

/** One table surface, spacing, empty state and overflow behavior for management lists. */
export function DataTable<T>({ label, rows, columns, rowKey, emptyTitle = '暂无记录', emptyDescription }: {
    label: string
    rows: readonly T[]
    columns: TableColumn<T>[]
    rowKey: (row: T) => Key
    emptyTitle?: string
    emptyDescription?: string
}) {
    return <Card className="overflow-hidden">
        {rows.length ? <TableScroll label={label}>
            <table className="coeer-data-table w-full min-w-[760px] table-fixed text-sm">
                <colgroup>{columns.map(column => <col key={column.key} style={column.width ? { width: column.width } : undefined} />)}</colgroup>
                <thead className="border-b border-border bg-muted text-left text-xs text-muted-foreground">
                    <tr>{columns.map(column => <th key={column.key} scope="col" className="px-4 py-3 font-medium" style={{ textAlign: column.align }}>{column.header}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">{rows.map(row => <tr key={rowKey(row)} className="align-middle">
                    {columns.map(column => <td key={column.key} className="break-words px-4 py-4" style={{ textAlign: column.align }}>{column.render(row)}</td>)}
                </tr>)}</tbody>
            </table>
        </TableScroll> : <div className="p-8"><EmptyState title={emptyTitle} description={emptyDescription} /></div>}
    </Card>
}

export function RowActions({ children }: { children: ReactNode }) {
    return <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
}
