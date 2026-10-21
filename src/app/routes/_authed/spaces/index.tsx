import { createFileRoute, Link } from '@tanstack/react-router'
import {
    Badge,
    Button,
    EmptyState,
    Field,
    FilterPanel,
    Icon,
    Input,
    LoadingState,
    Pagination,
    SectionHeader,
    Alert,
    paginate,
} from '@/components/coeer'
import { useSpaces, useSpaceResource } from '@/hooks/useSpaces'
import { addDays, today, validDate, type Space, type Availability } from '@shared/open-space/domain'
import { spaceModuleLabels, syncLabel } from '@/components/coeer/lib/spaces'

export const Route = createFileRoute('/_authed/spaces/')({ component: SpacesPage })

function SpacesPage() {
    const { config } = useSpaces()
    const filters = Route.useSearch()
    const navigate = Route.useNavigate()
    const resource = useSpaceResource<Space[]>('/spaces', 10000)
    const date = filters.date && validDate(filters.date) ? filters.date : addDays(today(), 1)
    const update = (values: Partial<typeof filters>) =>
        void navigate({
            search: (previous) => ({ ...previous, ...values, page: values.page ?? 1 }),
            replace: true,
        })
    const spaces = (resource.data ?? []).filter(
        (space) =>
            (filters.module === 'all' || space.module === filters.module) &&
            space.capacity >= filters.capacity &&
            `${space.name} ${space.location}`.toLowerCase().includes(filters.q.toLowerCase()),
    )
    const page = paginate(spaces, filters.page)
    return (
        <div className="space-y-6">
            <SectionHeader
                title="空间预约"
                description="查询空间空闲情况，选择连续时段提交预约。时间均采用北京时间。"
                action={
                    <Field label="预约日期">
                        <Input
                            type="date"
                            value={date}
                            min={today()}
                            max={addDays(today(), config!.horizon)}
                            onChange={(event) => event.target.value && update({ date: event.target.value })}
                        />
                    </Field>
                }
            />
            <FilterPanel
                searchValue={filters.q}
                searchPlaceholder="搜索名称或位置"
                onSearch={(q) => update({ q })}
                groups={[
                    {
                        title: '空间',
                        items: [
                            ['all', '全部'],
                            ['meeting', '会议空间'],
                            ['activity', '共享活动室'],
                        ].map(([key, label]) => ({
                            key,
                            label,
                            active: filters.module === key,
                            onClick: () => update({ module: key as typeof filters.module }),
                        })),
                    },
                    {
                        title: '人数',
                        items: [0, 6, 10, 16].map((capacity) => ({
                            key: String(capacity),
                            label: capacity ? `${capacity} 人及以上` : '不限',
                            active: filters.capacity === capacity,
                            onClick: () => update({ capacity }),
                        })),
                    },
                ]}
            />
            {resource.error && (
                <Alert tone="danger">
                    {resource.error}
                    <Button variant="ghost" size="sm" onClick={resource.reload}>
                        重试
                    </Button>
                </Alert>
            )}
            {resource.loading ? (
                <LoadingState />
            ) : !page.total ? (
                <EmptyState title="暂无匹配的空间" description="调整搜索与筛选条件，或等待管理员开放空间。" />
            ) : (
                <>
                    <p className="text-xs text-muted-foreground">共 {page.total} 处空间</p>
                    <div className="divide-y divide-border">
                        {page.items.map((space) => (
                            <SpaceRow key={space.id} space={space} date={date} />
                        ))}
                    </div>
                    {page.total > page.size && <Pagination {...page} onChange={(page) => update({ page })} />}
                </>
            )}
        </div>
    )
}

function SpaceRow({ space, date }: { space: Space; date: string }) {
    const availability = useSpaceResource<Availability>(
        `/spaces/${space.id}/availability?date=${date}`,
        10000,
    )
    const available = availability.data?.slots.filter((slot) => slot.state === 'available').length ?? 0
    return (
        <article className="grid min-w-0 gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(160px,.7fr)_auto] sm:items-center">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        to="/spaces/$spaceId"
                        params={{ spaceId: space.id }}
                        search={{ date }}
                        className="text-[15px] font-medium hover:text-primary"
                    >
                        {space.name}
                    </Link>
                    <Badge>{spaceModuleLabels[space.module]}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                    {space.location} · {space.capacity > 0 ? `最多 ${space.capacity} 人` : '人数待确认'}
                </p>
                <p className="mt-2 max-w-[70ch] text-[13px] leading-6 text-muted-foreground">
                    {space.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {space.amenities.map((item) => (
                        <Badge key={item} tone="muted">
                            {item}
                        </Badge>
                    ))}
                </div>
            </div>
            <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                    {availability.error
                        ? '时段读取失败'
                        : availability.data?.stale
                          ? '时段信息已过期'
                          : availability.loading
                            ? '正在查询时段…'
                            : `${available} 个空闲时段`}
                </p>
                <div aria-hidden="true" className="flex h-3 gap-0.5">
                    {(availability.data?.slots ?? []).map((slot, index) => (
                        <span
                            key={index}
                            className={`min-w-0 flex-1 rounded-sm ${slot.state === 'available' ? 'bg-success/30' : slot.state === 'pending_approval' ? 'bg-warning/30' : 'bg-muted-foreground/15'}`}
                        />
                    ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                    {syncLabel(availability.data?.observedAt)}
                </p>
            </div>
            <Button asChild variant="outline" size="sm">
                <Link to="/spaces/$spaceId" params={{ spaceId: space.id }} search={{ date }}>
                    查看时段
                    <Icon name="chevron" />
                </Link>
            </Button>
        </article>
    )
}
