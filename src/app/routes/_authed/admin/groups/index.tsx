import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import z from 'zod'
import { useState } from 'react'
import { DataTable, RowActions, PageLayout, StatusBadge, VisibilityBadge, filterGroup, groupCategoryLabels } from '@/components/coeer'
import type { GroupWithStats } from '@shared/contracts'
import { GROUP_CATEGORY_ARRAY, GROUP_STATUS_ARRAY, GroupStatus } from '@shared/constants'
import { deleteGroupFn, listAdminGroupsFn, updateGroupStatusFn } from '~/functions'
import { Button, Modal, Pagination, groupStatusLabels } from '@/components/coeer'

const searchSchema = z.object({
    scope: z.enum(['reviewed', 'pending']).optional(),
    status: z.enum(['all', 'pending']).optional(),
    search: z.string().optional(),
    category: z.enum(GROUP_CATEGORY_ARRAY).optional(),
    reviewStatus: z.enum(GROUP_STATUS_ARRAY).optional(),
    visibility: z.enum(['public', 'private']).optional(),
    page: z.number().int().min(1).default(1),
}).transform(value => ({ ...value, scope: value.scope ?? (value.status === 'pending' ? 'pending' : 'reviewed') }))

export const Route = createFileRoute('/_authed/admin/groups/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 10
        const result = await listAdminGroupsFn({
            data: {
                reviewScope: search.scope,
                status: search.scope === 'pending' || search.reviewStatus === 'pending' ? undefined : search.reviewStatus,
                category: search.category,
                isPublic: search.visibility ? search.visibility === 'public' : undefined,
                search: search.search,
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            },
        })
        return { groups: result?.items ?? [], total: result?.total ?? 0, pageSize }
    },
    component: AdminGroupsPage,
})

function AdminGroupsPage() {
    const { groups, total, pageSize } = Route.useLoaderData()
    const filters = Route.useSearch()
    const { scope, search, page, category, reviewStatus, visibility } = filters
    const router = useRouter()
    const [working, setWorking] = useState(false)
    const [error, setError] = useState('')
    const go = (next: Partial<typeof filters>) => void navigate({ to: '/admin/groups', search: { ...filters, page: 1, ...next } })
    const navigate = useNavigate()
    const [reviewing, setReviewing] = useState<GroupWithStats | null>(null)

    const refresh = async (removed = false) => {
        const nextPage = Math.max(1, Math.min(page, Math.ceil((total - (removed ? 1 : 0)) / pageSize)))
        if (nextPage !== page) await navigate({ to: '/admin/groups', search: { ...filters, page: nextPage } })
        await router.invalidate()
    }

    const submitReview = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!reviewing || working) return
        setWorking(true)
        setError('')
        try {
            const form = new FormData(e.currentTarget)
            const nextStatus = form.get('status') as GroupStatus
            await updateGroupStatusFn({
                data: {
                    id: reviewing.id,
                    status: nextStatus,
                    reviewNote: form.get('reviewNote') as string,
                },
            })
            const leavesScope = scope === 'pending' ? nextStatus !== 'pending'
                : nextStatus === 'pending' || (!!reviewStatus && reviewStatus !== 'pending' && reviewStatus !== nextStatus)
            await refresh(leavesScope)
            setReviewing(null)
        } catch (error) { setError(error instanceof Error ? error.message : '保存失败') }
        finally { setWorking(false) }
    }

    const remove = async (groupId: string) => {
        if (working || !confirm('确定删除这个群组吗？群组内的帖子和回复也会被删除，此操作不可撤销。')) return
        setWorking(true)
        setError('')
        try {
            await deleteGroupFn({ data: { groupId } })
            await refresh(true)
        } catch (error) { setError(error instanceof Error ? error.message : '删除失败') }
        finally { setWorking(false) }
    }

    return (
        <PageLayout title="群组管理"
            description="查看群组信息，维护审核状态与备注。"
            scope={{ title: '群组管理范围', items: [
                    { key: 'reviewed', label: '已审核群组', active: scope === 'reviewed', onClick: () => go({ scope: 'reviewed', status: undefined, reviewStatus: undefined }) },
                    { key: 'pending', label: '审核队列', active: scope === 'pending', onClick: () => go({ scope: 'pending', status: undefined, reviewStatus: undefined }) },
                ] }}
            filters={{
                searchValue: search,
                searchPlaceholder: "搜索群组名称、介绍或完整 slug",
                onSearch: search => go({ search: search || undefined }),
                onClear: () => go({ search: undefined, category: undefined, reviewStatus: undefined, visibility: undefined }),
                groups: [
                    filterGroup('类型', GROUP_CATEGORY_ARRAY, groupCategoryLabels, category, category => go({ category })),
                    filterGroup('公开性', ['public', 'private'] as const, { public: '公开', private: '私密' }, visibility, visibility => go({ visibility }), '全部'),
                    ...(scope === 'reviewed' ? [filterGroup('状态', ['approved', 'rejected'] as const, groupStatusLabels, reviewStatus === 'pending' ? undefined : reviewStatus, reviewStatus => go({ reviewStatus }), '全部状态')] : []),
                ]
            }}>

            {error && !reviewing && <p role="alert" className="text-sm text-danger">{error}</p>}
            <DataTable label="群组管理表" rows={groups} rowKey={group => group.id} emptyTitle="没有匹配的群组" columns={[
                { key: 'group', header: '群组', render: group => <><p className="font-medium">{group.name}</p><p className="mt-1 text-xs text-muted-foreground">群组地址：{group.slug}</p>{group.reviewNote && <p className="mt-1 text-xs text-muted-foreground">备注：{group.reviewNote}</p>}</> },
                { key: 'category', header: '类型', width: '7rem', render: group => groupCategoryLabels[group.category] || group.category },
                { key: 'visibility', header: '公开性', width: '6rem', render: group => <VisibilityBadge visible={group.isPublic} hiddenLabel="私密" /> },
                { key: 'status', header: '状态', width: '6rem', render: group => <StatusBadge status={group.status} labels={groupStatusLabels} /> },
                { key: 'actions', header: '操作', width: '10rem', align: 'right', render: group => <RowActions>
                    <Button size="sm" variant="outline" disabled={working} onClick={() => { setError(''); setReviewing(group) }}>{scope === 'pending' ? '审核' : '编辑'}</Button>
                    <Button size="sm" variant="danger" disabled={working} onClick={() => void remove(group.id)}>删除</Button>
                </RowActions> },
            ]} />
            <Pagination total={total} page={page} size={pageSize} onChange={page => go({ page })} />
            <Modal open={!!reviewing} title={reviewing?.status === 'pending' ? '审核群组' : '编辑群组'} onOpenChange={open => { if (!open && !working) setReviewing(null) }}>
                <form key={reviewing?.id} onSubmit={submitReview} className="space-y-4">
                    <label className="block text-sm font-medium">审核状态
                        <select name="status" defaultValue={reviewing?.status || 'pending'} className="coeer-field coeer-focus mt-2 h-10 w-full rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm">
                            {GROUP_STATUS_ARRAY.map((item) => <option key={item} value={item}>{groupStatusLabels[item]}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm font-medium">审核备注
                        <textarea name="reviewNote" defaultValue={reviewing?.reviewNote || ''} rows={4} className="coeer-field coeer-focus mt-2 w-full rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 py-2 text-sm" />
                    </label>
                    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                    <div className="coeer-form-actions"><Button type="button" variant="outline" disabled={working} onClick={() => setReviewing(null)}>取消</Button><Button type="submit" loading={working}>保存</Button></div>
                </form>
            </Modal>
        </PageLayout>
    )
}
