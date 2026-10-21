import { TableScroll } from '@/components/coeer/ui/TableScroll'
import { createFileRoute, type SearchSchemaInput } from '@tanstack/react-router'
import { z } from 'zod'
import {
    Alert,
    Badge,
    Card,
    EmptyState,
    Field,
    FilterPanel,
    LoadingState,
    Pagination,
    Select,
} from '@/components/coeer'
import { useSpaceResource } from '@/hooks/useSpaces'
import { useSpaceAdmin } from '@/hooks/useSpaceAdmin'
import { formatSpaceTime } from '@/components/coeer/lib/spaces'
import { auditActions, jobTypes } from '@shared/open-space/history'
import type { SpaceHistoryPage } from '@shared/contracts/spaces'

export const Route = createFileRoute('/_authed/admin/spaces/history')({
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) =>
        z
            .object({
                kind: z.enum(['sync-runs', 'jobs', 'audit']).catch('sync-runs').default('sync-runs'),
                q: z.string().max(80).catch('').default(''),
                state: z.string().max(80).catch('').default(''),
                page: z.coerce.number().int().min(1).catch(1).default(1),
            })
            .parse(search),
    component: SpaceHistoryPage,
})
const stateLabels: Record<string, string> = {
    success: '同步成功',
    failed: '执行失败',
    running: '执行中',
    pending: '等待执行',
    done: '已完成',
}

function SpaceHistoryPage() {
    const filters = Route.useSearch()
    const navigate = Route.useNavigate()
    const update = (values: Partial<typeof filters>) =>
        void navigate({
            search: (previous) => ({ ...previous, ...values, page: values.page ?? 1 }),
            replace: true,
        })
    const resource = useSpaceResource<SpaceHistoryPage>(
        `/admin/history/${filters.kind}?page=${filters.page}&size=10&q=${encodeURIComponent(filters.q)}&state=${encodeURIComponent(filters.state)}`,
        10000,
    )
    const admin = useSpaceAdmin()
    const options =
        filters.kind === 'audit'
            ? auditActions
            : filters.kind === 'jobs'
              ? { pending: '等待执行', running: '执行中', done: '已完成', failed: '执行失败' }
              : { success: '同步成功', running: '执行中', failed: '同步失败' }
    return (
        <div className="space-y-5">
            <p className="text-[13px] leading-6 text-muted-foreground">
                保留最近 24 小时的已结束记录，待处理和执行中的任务继续保留。凭据与官方原文不会写入审计记录。
            </p>
            <FilterPanel
                searchValue={filters.q}
                searchPlaceholder="搜索操作、记录编号或错误分类"
                onSearch={(q) => update({ q: q.slice(0, 80) })}
                groups={[
                    {
                        items: [
                            ['sync-runs', '空间同步'],
                            ['jobs', '任务队列'],
                            ['audit', '操作审计'],
                        ].map(([key, label]) => ({
                            key,
                            label,
                            active: filters.kind === key,
                            onClick: () => update({ kind: key as typeof filters.kind, state: '', q: '' }),
                        })),
                    },
                ]}
            />
            <Field label="状态 / 操作" className="max-w-xs">
                <Select value={filters.state} onChange={(event) => update({ state: event.target.value })}>
                    <option value="">全部</option>
                    {Object.entries(options).map(([key, label]) => (
                        <option key={key} value={key}>
                            {label}
                        </option>
                    ))}
                </Select>
            </Field>
            {admin.data?.adapter === 'mock' && (
                <label className="inline-flex items-center gap-2 text-xs">
                    <input
                        type="checkbox"
                        className="accent-primary"
                        checked={admin.data.mockSyncFailure}
                        disabled={admin.pending}
                        onChange={(event) =>
                            void admin.mutate('/admin/mock/sync', { failure: event.target.checked }, 'PATCH')
                        }
                    />
                    模拟同步失败
                </label>
            )}
            {(resource.error || admin.error) && <Alert tone="danger">{resource.error || admin.error}</Alert>}
            {resource.loading ? (
                <LoadingState />
            ) : resource.data?.items.length ? (
                <Card className="overflow-hidden">
                    <TableScroll label="任务与审计表">
                        <table className="w-full min-w-[620px] text-left text-xs">
                            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">记录</th>
                                    <th className="px-4 py-3 font-medium">状态 / 操作者</th>
                                    <th className="px-4 py-3 font-medium">时间</th>
                                    <th className="px-4 py-3 font-medium">详情</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {resource.data.items.map((entry) => (
                                    <tr key={entry.id} className="align-top hover:bg-muted/30">
                                        <td className="px-4 py-4">
                                            <p className="font-medium">
                                                {entry.action
                                                    ? auditActions[entry.action] || entry.action
                                                    : entry.type
                                                      ? jobTypes[entry.type] || entry.type
                                                      : '空间状态同步'}
                                            </p>
                                            <p className="mt-2 break-all text-[11px] text-muted-foreground">
                                                {String(entry.id)}
                                            </p>
                                        </td>
                                        <td className="px-4 py-4">
                                            {entry.action ? (
                                                entry.actor_name ||
                                                (entry.actor === 'system' ? '系统' : entry.actor)
                                            ) : (
                                                <Badge
                                                    tone={
                                                        ['success', 'done'].includes(
                                                            entry.status || entry.state || '',
                                                        )
                                                            ? 'success'
                                                            : entry.status === 'failed' ||
                                                                entry.state === 'failed'
                                                              ? 'danger'
                                                              : 'default'
                                                    }
                                                >
                                                    {stateLabels[entry.status || entry.state || ''] ||
                                                        '待处理'}
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-muted-foreground">
                                            {formatSpaceTime(
                                                entry.at ??
                                                    entry.finished_at ??
                                                    entry.started_at ??
                                                    entry.run_at,
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <details>
                                                <summary className="coeer-focus cursor-pointer rounded text-primary">
                                                    查看详情
                                                </summary>
                                                <dl className="mt-3 space-y-2 break-all text-[11px] text-muted-foreground">
                                                    {entry.booking_id && (
                                                        <div>
                                                            <dt>申请号</dt>
                                                            <dd>{entry.booking_id}</dd>
                                                        </div>
                                                    )}
                                                    {entry.error_code && (
                                                        <div>
                                                            <dt>错误分类</dt>
                                                            <dd>{entry.error_code}</dd>
                                                        </div>
                                                    )}
                                                    {entry.attempts !== undefined && (
                                                        <div>
                                                            <dt>尝试次数</dt>
                                                            <dd>{entry.attempts}</dd>
                                                        </div>
                                                    )}
                                                    {entry.snapshot_count !== undefined && (
                                                        <div>
                                                            <dt>时段快照</dt>
                                                            <dd>{entry.snapshot_count}</dd>
                                                        </div>
                                                    )}
                                                    {entry.entity_id && (
                                                        <div>
                                                            <dt>关联记录</dt>
                                                            <dd>{entry.entity_id}</dd>
                                                        </div>
                                                    )}
                                                    {entry.detail && (
                                                        <div>
                                                            <dt>操作摘要</dt>
                                                            <dd>{entry.detail}</dd>
                                                        </div>
                                                    )}
                                                </dl>
                                            </details>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </TableScroll>
                </Card>
            ) : (
                <EmptyState title="暂无匹配记录" description="调整类型、状态或搜索条件后重试。" />
            )}
            {resource.data && resource.data.total > resource.data.size && (
                <Pagination {...resource.data} onChange={(page) => update({ page })} />
            )}
        </div>
    )
}
