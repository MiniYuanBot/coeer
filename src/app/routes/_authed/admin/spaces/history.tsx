import { StatusBadge } from '@/components/coeer/ui/StatusBadge'
import { DataTable } from '@/components/coeer/ui/DataTable'
import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute, type SearchSchemaInput } from '@tanstack/react-router'
import { z } from 'zod'
import { Alert, EmptyState, LoadingState, Pagination } from '@/components/coeer'
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
        <PageLayout scope={{
                        title: '记录类型',
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
                    }}
            filters={{
                searchValue: filters.q,
                searchPlaceholder: "搜索操作、记录编号或错误分类",
                onSearch: (q) => update({ q: q.slice(0, 80) }),
                onClear: () => update({ q: '', state: '' }),
                groups: [{ title: '状态 / 操作', items: [
                    { key: '', label: '全部', active: !filters.state, onClick: () => update({ state: '' }) },
                    ...Object.entries(options).map(([key, label]) => ({ key, label, active: filters.state === key, onClick: () => update({ state: key }) })),
                ] }]
            }}>
            <p className="text-[13px] leading-6 text-muted-foreground">
                保留最近 24 小时的已结束记录，待处理和执行中的任务继续保留。凭据与官方原文不会写入审计记录。
            </p>

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
                <DataTable label="任务与审计表" rows={resource.data.items} rowKey={entry => entry.id} columns={[
                    { key: 'record', header: '记录', render: entry => <>
                        <p className="font-medium">{entry.action ? auditActions[entry.action] || entry.action : entry.type ? jobTypes[entry.type] || entry.type : '空间状态同步'}</p>
                        <p className="mt-2 break-all text-xs text-muted-foreground">{String(entry.id)}</p>
                    </> },
                    { key: 'status', header: '状态 / 操作者', width: '9rem', render: entry => entry.action
                        ? entry.actor_name || (entry.actor === 'system' ? '系统' : entry.actor)
                        : <StatusBadge status={entry.status || entry.state || 'pending'} labels={stateLabels} /> },
                    { key: 'time', header: '时间', width: '10rem', render: entry => formatSpaceTime(entry.at ?? entry.finished_at ?? entry.started_at ?? entry.run_at) },
                    { key: 'details', header: '详情', width: '10rem', render: entry => <details>
                        <summary className="coeer-focus cursor-pointer rounded text-primary">查看详情</summary>
                        <dl className="mt-3 space-y-2 break-all text-xs text-muted-foreground">
                            {entry.booking_id && <div><dt>申请号</dt><dd>{entry.booking_id}</dd></div>}
                            {entry.error_code && <div><dt>错误分类</dt><dd>{entry.error_code}</dd></div>}
                            {entry.attempts !== undefined && <div><dt>尝试次数</dt><dd>{entry.attempts}</dd></div>}
                            {entry.snapshot_count !== undefined && <div><dt>时段快照</dt><dd>{entry.snapshot_count}</dd></div>}
                            {entry.entity_id && <div><dt>关联记录</dt><dd>{entry.entity_id}</dd></div>}
                            {entry.detail && <div><dt>操作摘要</dt><dd>{entry.detail}</dd></div>}
                        </dl>
                    </details> },
                ]} />
            ) : (
                <EmptyState title="暂无匹配记录" description="调整类型、状态或搜索条件后重试。" />
            )}
            {resource.data && resource.data.total > resource.data.size && (
                <Pagination {...resource.data} onChange={(page) => update({ page })} />
            )}
        </PageLayout>
    )
}
