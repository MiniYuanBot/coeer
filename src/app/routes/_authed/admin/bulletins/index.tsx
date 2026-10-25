import { DataTable, RowActions, PageLayout, StatusBadge } from '@/components/coeer'
import { filterGroup } from '@/components/coeer/ui/FilterPanel'
import { BULLETIN_TYPE_ARRAY } from '@shared/constants'
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { Button, Icon, Pagination } from '@/components/coeer'
import { bulletinTypeLabels } from '@/components/coeer'
import { deleteBulletinFn, getBulletinFeedFn } from '~/functions'

const searchSchema = z.object({ type: z.enum(BULLETIN_TYPE_ARRAY).optional(), pinned: z.enum(['pinned', 'unpinned']).optional(), search: z.string().optional(), page: z.number().int().min(1).default(1) })

export const Route = createFileRoute('/_authed/admin/bulletins/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 20
        const result = await getBulletinFeedFn({ data: { type: search.type, isPinned: search.pinned ? search.pinned === 'pinned' : undefined, search: search.search, limit: pageSize, offset: (search.page - 1) * pageSize } })
        return { bulletins: result.data?.items ?? [], total: result.data?.total ?? 0, pageSize }
    },
    component: AdminBulletinsPage,
})

function AdminBulletinsPage() {
    const { bulletins, total = 0 } = Route.useLoaderData()
    const filters = Route.useSearch()
    const { page, type, pinned, search } = filters
    const navigate = useNavigate()
    const router = useRouter()
    const go = (next: Partial<typeof filters>) => void navigate({ to: '/admin/bulletins', search: { ...filters, page: 1, ...next } })
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const refresh = async () => {
        await router.invalidate()
        await navigate({ to: '/admin/bulletins', search: filters })
    }

    const remove = async (id: string) => {
        if (pending || !confirm('确定删除这条公告吗？')) return
        setPending(true)
        setError('')
        try {
            const result = await deleteBulletinFn({ data: { id } })
            if (!result.success) throw new Error(result.state.message || '删除公告失败')
            await refresh()
        } catch (error) { setError(error instanceof Error ? error.message : '删除公告失败') }
        finally { setPending(false) }
    }

    return <PageLayout title="公告管理"
            description="发布、编辑和删除公告。最多置顶 5 条公告。"
            action={<Button asChild><Link to="/admin/bulletins/create" search={{ page }}><Icon name="plus" />新建公告</Link></Button>}
            scope={{ title: '公告管理范围', items: [{ key: 'all', label: '全部公告', active: true, onClick: () => go({ page: 1 }) }] }}
            filters={{
                searchValue: search,
                searchPlaceholder: "搜索公告标题或内容",
                onSearch: search => go({ search: search || undefined }),
                onClear: () => go({ search: undefined, type: undefined, pinned: undefined }),
                groups: [filterGroup('置顶', ['pinned', 'unpinned'] as const, { pinned: '已置顶', unpinned: '未置顶' }, pinned, pinned => go({ pinned }), '全部'), filterGroup('类型', BULLETIN_TYPE_ARRAY, bulletinTypeLabels, type, type => go({ type }))]
            }}>

        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <DataTable label="公告管理表" rows={bulletins} rowKey={item => item.id} emptyTitle="暂无公告" columns={[
            { key: 'title', header: '公告', render: item => <span className="font-medium">{item.title}</span> },
            { key: 'type', header: '类型', width: '8rem', render: item => bulletinTypeLabels[item.type] || item.type },
            { key: 'notification', header: '通知方式', width: '8rem', render: item => ({ none: '无特殊通知', modal: '居中弹窗', banner: '顶部横幅' })[item.notificationMode] },
            { key: 'pin', header: '置顶状态', width: '7rem', render: item => <StatusBadge status={item.isPinned ? 'pinned' : 'normal'} labels={{ pinned: '已置顶', normal: '未置顶' }} tone={item.isPinned ? 'primary' : 'default'} /> },
            { key: 'actions', header: '操作', width: '10rem', align: 'right', render: item => <RowActions><Button size="sm" asChild variant="outline"><Link to="/admin/bulletins/$bulletinId/edit" params={{ bulletinId: item.id }} search={{ page }}>编辑</Link></Button><Button size="sm" variant="danger" disabled={pending} onClick={() => remove(item.id)}>删除</Button></RowActions> },
        ]} />
            <Pagination total={total} page={page} size={20} onChange={page => go({ page })} />

    </PageLayout>
}
