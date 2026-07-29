import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { z } from 'zod'
import { confirmDormFn, computeDormFn, createDormCycleFn, getDormAdminOverviewFn, updateDormRoomFn } from '~/functions'
import { Badge, Button, Card, EmptyState, Icon, Modal, SectionHeader, dormCycleStatusLabels, dormRoomStatusLabels, formatDateTime, useAsyncAction, useToast } from '@/components/coeer'
import type { DormAdminOverview, DormQuestionnaireSummary, DormRoom, DormCycle } from '@shared/contracts'

type DormAdminLoaderData = DormAdminOverview | undefined

const searchSchema = z.object({
    cycleId: z.string().uuid().optional(),
})

export const Route = createFileRoute('/_authed/admin/dorms/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }): Promise<DormAdminLoaderData> => {
        return getDormAdminOverviewFn({ data: { cycleId: search.cycleId } })
    },
    component: AdminDormPage,
})

function AdminDormPage() {
    const overview = Route.useLoaderData()
    const { cycleId } = Route.useSearch()
    const navigate = useNavigate()
    const { toast } = useToast()
    const { loadingKey, run } = useAsyncAction()
    const [editingRoom, setEditingRoom] = React.useState<DormRoom | null>(null)
    const [creating, setCreating] = React.useState(false)

    const activeCycle = overview?.activeCycle ?? null
    const rooms = overview?.rooms ?? []
    const submissions = overview?.submissions ?? []
    const cycles = overview?.cycles ?? []
    const memberLookup = React.useMemo(() => {
        return new Map(submissions.map((item) => [item.userId, item.user]))
    }, [submissions])

    const refresh = () => navigate({ to: '/admin/dorms', search: { cycleId: cycleId || activeCycle?.id } })

    const submitCycle = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        setCreating(true)
        try {
            const cycle = await createDormCycleFn({
                data: {
                    code: String(form.get('code') || ''),
                    label: String(form.get('label') || ''),
                    cohortLabel: String(form.get('cohortLabel') || ''),
                    questionnaireVersion: (form.get('questionnaireVersion') as string) || undefined,
                },
            })
            toast({ title: '届次已创建', tone: 'success' })
            if (cycle?.id) {
                navigate({ to: '/admin/dorms', search: { cycleId: cycle.id } })
            }
        } catch (error) {
            toast({ title: '创建失败', description: error instanceof Error ? error.message : undefined, tone: 'danger' })
        } finally {
            setCreating(false)
        }
    }

    const startCompute = async () => {
        if (!activeCycle) return
        await run(activeCycle.id, () => computeDormFn({ data: { cycleId: activeCycle.id } }), {
            success: '已重新计算宿舍',
            error: '计算失败',
        })
        refresh()
    }

    const confirmResult = async () => {
        if (!activeCycle) return
        await run(`${activeCycle.id}-confirm`, () => confirmDormFn({ data: { cycleId: activeCycle.id } }), {
            success: '宿舍结果已下发',
            error: '确认失败',
        })
        refresh()
    }

    const submitRoom = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!editingRoom || !activeCycle) return
        const form = new FormData(e.currentTarget)
        const members = form.getAll('members').map(String)
        await updateDormRoomFn({
            data: {
                cycleId: activeCycle.id,
                roomId: editingRoom.id,
                roomCode: String(form.get('roomCode') || editingRoom.roomCode),
                building: (form.get('building') as string) || undefined,
                floor: form.get('floor') ? Number(form.get('floor')) : undefined,
                members,
            },
        })
        setEditingRoom(null)
        refresh()
    }

    return (
        <div className="space-y-6">
            <SectionHeader
                title="宿舍管理"
                description="按届次运行宿舍分配，手动调整房间后再确认下发。"
            />

            <Card className="grid gap-4 p-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-2">
                    <div className="text-sm font-medium">当前届次</div>
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">选择或创建一个宿舍届次，再执行算法。</div>
                    <select
                        value={cycleId || activeCycle?.id || ''}
                        onChange={(e) => navigate({ to: '/admin/dorms', search: { cycleId: e.target.value || undefined } })}
                        className="coeer-focus h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm"
                    >
                        <option value="">选择届次</option>
                        {cycles.map((cycle: DormCycle) => (
                            <option key={cycle.id} value={cycle.id}>
                                {cycle.label} · {cycle.cohortLabel}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    <HeaderMetric label="问卷" value={String(overview?.questionnaireCount ?? 0)} tone="primary" />
                    <HeaderMetric label="未分配" value={String(overview?.unassignedCount ?? 0)} tone="warning" />
                    <HeaderMetric label="状态" value={activeCycle ? dormCycleStatusLabels[activeCycle.status] || activeCycle.status : '无届次'} tone={activeCycle ? 'success' : 'default'} />
                </div>
            </Card>

            <Card className="rounded-xl p-5">
                <form onSubmit={submitCycle} className="grid gap-3 md:grid-cols-4">
                    <input name="code" required placeholder="届次代码，例如 2026-freshman" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    <input name="label" required placeholder="届次名称，例如 2026 新生宿舍" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    <input name="cohortLabel" required placeholder="批次标签，例如 2026级" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    <input name="questionnaireVersion" placeholder="问卷版本" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    <div className="md:col-span-4 flex justify-end">
                        <Button type="submit" loading={creating}>
                            <Icon name="spark" /> 创建届次
                        </Button>
                    </div>
                </form>
            </Card>

            {!activeCycle ? (
                <EmptyState title="没有可操作的届次" description="先创建一个新届次，再运行宿舍算法。" />
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-4">
                        <Stat label="问卷版本" value={activeCycle.questionnaireVersion || '默认'} />
                        <Stat label="创建时间" value={formatDateTime(activeCycle.createdAt)} />
                        <Stat label="房间数" value={String(activeCycle.roomCount)} />
                        <Stat label="确认状态" value={activeCycle.confirmedRoomCount > 0 ? '已确认部分房间' : '未确认'} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button loading={loadingKey === activeCycle.id} onClick={startCompute}><Icon name="activity" /> 运行分配</Button>
                        <Button variant="outline" onClick={confirmResult}><Icon name="check" /> 确认下发</Button>
                        <Button variant="outline" onClick={refresh}><Icon name="spark" /> 刷新</Button>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                        <Card className="overflow-hidden rounded-xl">
                            <div className="border-b border-[hsl(var(--border))] px-4 py-3 text-sm font-medium">分配结果</div>
                            {rooms.length ? (
                                <div className="divide-y divide-[hsl(var(--border))]">
                                    {rooms.map((room) => (
                                        <div key={room.id} className="p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="text-[15px] font-medium">{room.roomCode}</div>
                                                        <Badge tone="primary">{room.poolTag}</Badge>
                                                        <Badge>{dormRoomStatusLabels[room.status] || room.status}</Badge>
                                                    </div>
                                                    <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{room.building || '待定楼栋'} · {room.floor ?? '待定楼层'} · {room.members.length}/{room.capacity}</div>
                                                </div>
                                                <Button size="sm" variant="outline" onClick={() => setEditingRoom(room)}>调整</Button>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                                                {room.members.map((memberId) => (
                                                    <span key={memberId} className="inline-block rounded-full border border-[hsl(var(--border))] px-2 py-1 text-xs">
                                                        {memberLookup.get(memberId)?.name || memberLookup.get(memberId)?.email || memberId}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-6"><EmptyState title="暂无分配结果" description="点击运行分配后，这里会展示房间结果。" /></div>
                            )}
                        </Card>

                        <Card className="overflow-hidden rounded-xl">
                            <div className="border-b border-[hsl(var(--border))] px-4 py-3 text-sm font-medium">提交名单</div>
                            {submissions.length ? (
                                <div className="divide-y divide-[hsl(var(--border))]">
                                    {submissions.map((item) => (
                                        <div key={item.id} className="p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-medium">{item.user?.name || item.user?.email || item.userId}</div>
                                                    <div className="text-xs text-[hsl(var(--muted-foreground))]">{item.cohortLabel} · {item.studentNo || '无学号'}</div>
                                                </div>
                                                <Badge>{item.gender}</Badge>
                                            </div>
                                            <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{item.college || '未填学院'} · {item.major || '未填专业'}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-6"><EmptyState title="暂无提交" description="学生提交问卷后会出现在这里。" /></div>
                            )}
                        </Card>
                    </div>
                </>
            )}

            <Modal open={!!editingRoom} title="调整宿舍" onOpenChange={(open) => !open && setEditingRoom(null)}>
                {editingRoom ? (
                    <form onSubmit={submitRoom} className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-sm font-medium">
                                <span>房间号</span>
                                <input name="roomCode" defaultValue={editingRoom.roomCode} className="coeer-focus mt-2 h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                            </label>
                            <label className="block text-sm font-medium">
                                <span>宿舍楼</span>
                                <input name="building" defaultValue={editingRoom.building || ''} className="coeer-focus mt-2 h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                            </label>
                            <label className="block text-sm font-medium">
                                <span>楼层</span>
                                <input name="floor" type="number" defaultValue={editingRoom.floor ?? ''} className="coeer-focus mt-2 h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                            </label>
                        </div>
                        <label className="block text-sm font-medium">
                            <span>成员</span>
                            <select
                                multiple
                                name="members"
                                defaultValue={editingRoom.members}
                                className="coeer-focus mt-2 min-h-40 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm"
                            >
                                {submissions.map((item: DormQuestionnaireSummary) => (
                                    <option key={item.userId} value={item.userId}>
                                        {item.user?.name || item.user?.email || item.userId} · {item.cohortLabel}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setEditingRoom(null)}>取消</Button>
                            <Button type="submit">保存</Button>
                        </div>
                    </form>
                ) : null}
            </Modal>
        </div>
    )
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <Card className="p-4">
            <div className="text-xs text-[hsl(var(--muted-foreground))]">{label}</div>
            <div className="mt-1 text-sm font-medium">{value}</div>
        </Card>
    )
}

function HeaderMetric({ label, value, tone }: { label: string; value: string; tone: 'primary' | 'warning' | 'success' | 'default' }) {
    const toneClass = {
        primary: 'border-[hsl(var(--primary)/0.22)] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]',
        warning: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        default: 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.45)] text-[hsl(var(--foreground))]',
    }[tone]

    return (
        <div className={`min-h-16 rounded-lg border px-3 py-2 ${toneClass}`}>
            <div className="text-xs text-current/70">{label}</div>
            <div className="mt-1 truncate text-sm font-medium tabular-nums" title={value}>{value}</div>
        </div>
    )
}
