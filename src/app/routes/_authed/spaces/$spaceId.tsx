import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
    Alert,
    Badge,
    Button,
    Card,
    EmptyState,
    Field,
    Input,
    LoadingState,
    SectionHeader,
    Textarea,
    cn,
} from '@/components/coeer'
import { spaceApi, SpaceApiError, useSpaces, useSpaceResource } from '@/hooks/useSpaces'
import { bookingStatusTone, spaceModuleLabels, syncLabel } from '@/components/coeer/lib/spaces'
import {
    addDays,
    coversRange,
    slotInstant,
    slotLabels,
    timeLabel,
    today,
    validDate,
    type Availability,
    type Booking,
    type Slot,
    type Space,
} from '@shared/open-space/domain'

export const Route = createFileRoute('/_authed/spaces/$spaceId')({ component: SpaceDetailPage })

function SpaceDetailPage() {
    const { spaceId } = Route.useParams()
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    const { config, user } = useSpaces()
    const date = search.date && validDate(search.date) ? search.date : addDays(today(), 1)
    const room = useSpaceResource<Space>(`/spaces/${spaceId}`, 10000)
    const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
    const [quantity, setQuantity] = useState(1)
    const [purpose, setPurpose] = useState('')
    const [message, setMessage] = useState('')
    const [busy, setBusy] = useState(false)
    const availability = useSpaceResource<Availability>(`/spaces/${spaceId}/availability?date=${date}`, 5000, { enabled: !busy })
    const idempotency = useRef<{ body: string; key: string } | null>(null)
    const slots = availability.data?.slots ?? []
    const canUse = (slot: Slot) =>
        slot.state === 'available' &&
        slotInstant(date, slot.start) > Date.now() &&
        (slot.kind === 'meeting' || slot.remaining >= quantity)

    useEffect(() => {
        setSelection(null)
        setMessage('')
    }, [date, spaceId])
    useEffect(() => {
        if (busy || !selection || !availability.data) return
        const selected = availability.data.slots.filter(
            (slot) => slot.start >= selection.start && slot.end <= selection.end,
        )
        if (
            availability.data.stale ||
            !coversRange(selected, selection.start, selection.end) ||
            selected.some((slot) => !canUse(slot))
        ) {
            setSelection(null)
            setMessage('所选时段状态已变化，请重新选择。')
        }
    }, [availability.data, quantity, selection, date, busy])

    function select(slot: Slot) {
        setMessage('')
        if (selection && slot.start >= selection.start && slot.end <= selection.end) {
            setSelection(null)
            return
        }
        const start = Math.min(selection?.start ?? slot.start, slot.start)
        const end = Math.max(selection?.end ?? slot.end, slot.end)
        const selected = slots.filter((item) => item.start >= start && item.end <= end)
        if (!coversRange(slots, start, end) || selected.some((item) => !canUse(item))) {
            setSelection({ start: slot.start, end: slot.end })
            setMessage('中间存在不可预约时段，已从当前时段重新选择。')
        } else setSelection({ start, end })
    }
    async function submit(event: FormEvent) {
        event.preventDefault()
        if (busy) return
        if (!user) {
            setMessage('请先登录学生或管理员账号。')
            return
        }
        if (!selection) return
        const body = JSON.stringify({ spaceId, date, ...selection, quantity, purpose })
        if (idempotency.current?.body !== body) idempotency.current = { body, key: crypto.randomUUID() }
        setBusy(true)
        setMessage('')
        try {
            const booking = await spaceApi<Booking>('/bookings', {
                method: 'POST',
                body,
                headers: { 'Idempotency-Key': idempotency.current.key },
            })
            await navigate({ to: '/spaces/bookings/$bookingId', params: { bookingId: booking.id } })
        } catch (error) {
            if (error instanceof SpaceApiError && error.bookingId) {
                await navigate({ to: '/spaces/bookings/$bookingId', params: { bookingId: error.bookingId } })
                return
            }
            setMessage((error as Error).message)
        } finally {
            setBusy(false)
        }
    }
    if (room.loading) return <LoadingState />
    const space = room.data
    if (!space)
        return (
            <EmptyState
                title="空间暂不可用"
                description={room.error || '该空间不存在或尚未公开。'}
                action={
                    <Button asChild variant="outline">
                        <Link to="/spaces">返回目录</Link>
                    </Button>
                }
            />
        )
    return (
        <div className="space-y-6">
            <Link
                to="/spaces"
                className="coeer-focus inline-flex rounded text-xs text-muted-foreground hover:text-foreground"
            >
                返回空间目录
            </Link>
            <SectionHeader
                title={space.name}
                description={`${space.location} · ${space.capacity > 0 ? `最多 ${space.capacity} 人` : '人数待确认'}`}
                action={<Badge>{spaceModuleLabels[space.module]}</Badge>}
            />
            <div className="flex flex-wrap gap-2">
                {space.amenities.map((item) => (
                    <Badge key={item}>{item}</Badge>
                ))}
            </div>
            <div className="coeer-space-layout">
                <section className="coeer-content-panel min-w-0 space-y-5">
                    <p className="max-w-[70ch] text-[13px] leading-6 text-muted-foreground">
                        {space.description}
                    </p>
                    <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
                        <div>
                            <h2 className="text-sm font-medium">
                                {config!.writesEnabled ? '选择预约时段' : '时段状态'}
                            </h2>
                            <p className="mt-2 text-xs text-muted-foreground">
                                点击空闲时段扩展选择，点击已选时段清空。
                            </p>
                        </div>
                        <Field label="预约日期">
                            <Input
                                type="date"
                                disabled={busy}
                                min={today()}
                                max={addDays(today(), config!.horizon)}
                                value={date}
                                onChange={(event) =>
                                    event.target.value &&
                                    void navigate({
                                        search: (previous) => ({ ...previous, date: event.target.value }),
                                        replace: true,
                                    })
                                }
                            />
                        </Field>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(44px,1fr))] gap-1.5 sm:grid-cols-7">
                        {Array.from({ length: Math.min(7, config!.horizon + 1) }, (_, index) =>
                            addDays(today(), index),
                        ).map((day) => (
                            <Button
                                key={day}
                                disabled={busy}
                                variant={day === date ? 'primary' : 'outline'}
                                className="h-auto min-w-0 flex-col px-1 py-2"
                                aria-pressed={day === date}
                                onClick={() =>
                                    void navigate({
                                        search: (previous) => ({ ...previous, date: day }),
                                        replace: true,
                                    })
                                }
                            >
                                <span className="text-xs">
                                    {new Date(`${day}T12:00:00+08:00`).toLocaleDateString('zh-CN', {
                                        weekday: 'short',
                                        timeZone: 'Asia/Shanghai',
                                    })}
                                </span>
                                <span className="text-base tabular-nums">{day.slice(-2)}</span>
                            </Button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(slotLabels).map(([key, label]) => (
                            <Badge
                                key={key}
                                tone={
                                    key === 'available'
                                        ? 'success'
                                        : key === 'pending_approval'
                                          ? 'warning'
                                          : 'default'
                                }
                            >
                                {label}
                            </Badge>
                        ))}
                    </div>
                    {availability.error && <Alert tone="danger">{availability.error}</Alert>}
                    {availability.data?.stale && (
                        <Alert tone="warning">时段信息已过期，完成同步前暂时无法预约。</Alert>
                    )}
                    {availability.loading ? (
                        <LoadingState />
                    ) : (
                        <div
                            className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4"
                            aria-label="可预约时段"
                        >
                            {slots.map((slot) => {
                                const selected =
                                    !!selection && slot.start >= selection.start && slot.end <= selection.end
                                return (
                                    <Button
                                        key={slot.start}
                                        variant={selected ? 'primary' : 'outline'}
                                        disabled={
                                            busy || !canUse(slot) ||
                                            availability.data?.stale ||
                                            !config!.writesEnabled
                                        }
                                        aria-pressed={selected}
                                        onClick={() => select(slot)}
                                        className={cn(
                                            'h-auto min-h-16 flex-col items-start gap-1 px-3 py-2',
                                            !selected && canUse(slot) && 'border-success/25 bg-success-soft',
                                        )}
                                    >
                                        <strong className="text-xs tabular-nums">
                                            {timeLabel(slot.start)}–{timeLabel(slot.end)}
                                        </strong>
                                        <span className="text-xs">
                                            {slotLabels[slot.state]}
                                            {slot.kind === 'activity' && slot.state === 'available'
                                                ? ` · 余 ${slot.remaining} 人`
                                                : ''}
                                        </span>
                                    </Button>
                                )
                            })}
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                        {syncLabel(availability.data?.observedAt)} · 北京时间 UTC+8
                    </p>
                </section>
                <Card className="space-y-5 p-5">
                    <h2 className="text-sm font-medium">预约申请</h2>
                    <div aria-live="polite" className="space-y-2 border-y border-border py-4">
                        <p className="text-xs text-muted-foreground">{date}</p>
                        <p className="text-lg font-medium tabular-nums">
                            {selection
                                ? `${timeLabel(selection.start)}–${timeLabel(selection.end)}`
                                : '尚未选择时段'}
                        </p>
                    </div>
                    {user ? (
                        <p className="text-xs leading-6 text-muted-foreground">
                            预约人：{user.name}
                            <br />
                            {user.studentId ? `${user.role === 'admin' ? '管理员学号' : '学号'}：${user.studentId}` : '当前账号缺少预约学号'}
                        </p>
                    ) : (
                        <Alert>请使用 COEER 学生或管理员账号登录，昵称和学号将自动带入申请。</Alert>
                    )}
                    {user?.bookingPermission === 'blocked' && (
                        <Alert tone="danger">当前账号没有预约权限，请联系管理员将你的学号加入预约白名单。</Alert>
                    )}
                    {user?.bookingPermission === 'review' && (
                        <Alert tone="warning">每笔预约需管理员审核，审核前不占用时段。</Alert>
                    )}
                    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
                        {space.module === 'activity' && (
                            <Field label="预约人数">
                                <Input
                                    type="number"
                                    disabled={busy}
                                    min={1}
                                    max={space.capacity || 100}
                                    value={quantity}
                                    onChange={(event) => setQuantity(Number(event.target.value))}
                                    required
                                />
                            </Field>
                        )}
                        <Field label="使用用途">
                            <Textarea
                                disabled={busy}
                                value={purpose}
                                onChange={(event) => setPurpose(event.target.value)}
                                minLength={2}
                                maxLength={200}
                                required={!!user}
                                placeholder="简要说明活动或讨论内容"
                            />
                        </Field>
                        {message && <Alert tone="danger">{message}</Alert>}
                        <Button
                            type="submit"
                            className="w-full"
                            loading={busy}
                            disabled={
                                !config!.writesEnabled ||
                                !space.bookable ||
                                !space.upstreamEnabled ||
                                availability.data?.stale ||
                                !!availability.error ||
                                !availability.data ||
                                !user || !user.studentId || !selection || user.bookingPermission === 'blocked'
                            }
                        >
                            {busy ? '正在保存申请…' : '提交预约申请'}
                        </Button>
                    </form>
                    <p className="text-xs leading-6 text-muted-foreground">
                        {!config!.writesEnabled || !space.bookable
                            ? '当前仅供查询，暂不接受预约。'
                            : space.policy.kind === 'meeting' && space.policy.approval
                              ? '此空间需要官方审批，请以最终确认结果为准。'
                              : '提交后进入预约详情，处理进度和最终结果会自动更新。'}
                    </p>
                </Card>
            </div>
        </div>
    )
}
