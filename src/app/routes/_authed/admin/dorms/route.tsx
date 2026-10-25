import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'
import { z } from 'zod'
import { getDormAdminOverviewFn } from '~/functions'
import { Badge, SectionHeader, Select, dormCycleStatusLabels } from '@/components/coeer'
import { NavTabs, navTabClass } from '@/components/coeer/ui/NavTabs'

export const Route = createFileRoute('/_authed/admin/dorms')({
    validateSearch: z.object({ cycleId: z.string().uuid().optional() }),
    loaderDeps: ({ search }) => ({ cycleId: search.cycleId }),
    loader: ({ deps }) => getDormAdminOverviewFn({ data: deps }),
    component: DormAdminLayout,
})

function DormAdminLayout() {
    const overview = Route.useLoaderData()
    const { cycleId } = Route.useSearch()
    const navigate = Route.useNavigate()
    const path = useLocation({ select: location => location.pathname })
    const active = overview?.activeCycle
    const search = { cycleId: cycleId || active?.id }
    return <div className="space-y-6">
        <SectionHeader title="宿舍管理" description="按届次收集问卷、核对分配结果，再确认下发。" />
        <NavTabs label="宿舍管理">
            <Link to="/admin/dorms" search={search} activeOptions={{ exact: true, includeSearch: false }} className={navTabClass}>执行分配</Link>
            <Link to="/admin/dorms/questionnaires" search={search} activeOptions={{ includeSearch: false }} className={navTabClass}>问卷记录</Link>
            <Link to="/admin/dorms/new" search={search} activeOptions={{ includeSearch: false }} className={navTabClass}>添加问卷</Link>
        </NavTabs>
        {!path.endsWith('/new') && <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-w-0 flex-wrap items-center gap-3 text-xs font-medium">
                <span>当前届次</span>
                <Select className="w-full sm:w-80" value={active?.id || ''}
                    onChange={event => void navigate({ search: { cycleId: event.target.value || undefined } })}>
                    {!active && <option value="">选择届次</option>}
                    {overview?.cycles.map(cycle => <option key={cycle.id} value={cycle.id}>{cycle.label} · {cycle.cohortLabel}</option>)}
                </Select>
            </label>
            {active && <Badge tone={active.status === 'confirmed' ? 'success' : 'default'}>{dormCycleStatusLabels[active.status]}</Badge>}
        </div>}
        <Outlet />
    </div>
}
