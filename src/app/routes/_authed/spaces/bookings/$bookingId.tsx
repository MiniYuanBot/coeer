import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
    Alert,
    Badge,
    Button,
    Card,
    DetailLayout,
    EmptyState,
    LoadingState,
    Modal,
    SectionHeader,
} from '@/components/coeer'
import { spaceApi, useSpaces, useSpaceResource } from '@/hooks/useSpaces'
import { bookingStatusTone, formatSpaceTime, spaceModuleLabels } from '@/components/coeer/lib/spaces'
import { slotInstant, statusLabels, timeLabel, type Booking } from '@shared/open-space/domain'

export const Route = createFileRoute('/_authed/spaces/bookings/$bookingId')({ component: BookingDetailPage })

function BookingDetailPage() {
    const { bookingId } = Route.useParams()
    const { user } = useSpaces()
    const resource = useSpaceResource<Booking>(user ? `/bookings/${bookingId}` : null, 3000)
    const [confirm, setConfirm] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    async function cancel() {
        setBusy(true)
        setError('')
        try {
            await spaceApi(`/bookings/${bookingId}/cancel`, { method: 'POST', body: '{}' })
            setConfirm(false)
            resource.reload()
        } catch (error) {
            setError((error as Error).message)
        } finally {
            setBusy(false)
        }
    }
    if (!user)
        return (
            <EmptyState
                title="当前账号暂不能预约"
                description="请使用学生或管理员账号，或联系管理员检查预约身份。"
            />
        )
    if (resource.loading) return <LoadingState />
    const booking = resource.data
    if (!booking)
        return (
            <EmptyState title="无法读取预约" description={resource.error || '预约不存在或你没有查看权限。'} />
        )
    return (
        <PageLayout>
            <Link
                to="/spaces/bookings"
                className="coeer-focus rounded text-xs text-muted-foreground hover:text-foreground"
            >
                返回我的预约
            </Link>
            <SectionHeader
                title="预约进度"
                description="申请已保存，处理进度和预约结果会在这里自动更新。"
                action={
                    <span role="status"><Badge tone={bookingStatusTone(booking.status)}>{statusLabels[booking.status]}</Badge></span>
                }
            />
            {(error || resource.error) && <Alert tone="danger">{error || resource.error}</Alert>}
            <DetailLayout asideLabel="预约处理进度" aside={
                <section className="space-y-5 border-t border-border pt-5">
                    <h2 className="text-sm font-semibold">处理进度</h2>
                    <ol aria-label="预约处理记录" className="ml-2 space-y-6 border-l border-border pl-5">
                        {booking.events?.map((event) => (
                            <li key={event.id} className="relative">
                                <span
                                    aria-hidden="true"
                                    className="absolute -left-[24px] top-2 h-1.5 w-1.5 rounded-full bg-primary"
                                />
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-[13px] font-medium">{statusLabels[event.status]}</span>
                                    <time className="text-xs text-muted-foreground">{formatSpaceTime(event.at)}</time>
                                </div>
                                <p className="mt-2 text-xs leading-6 text-muted-foreground">{event.message}</p>
                            </li>
                        ))}
                    </ol>
                </section>
            }>
                <Card className="space-y-5 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-base font-medium">{booking.spaceName}</h2>
                        <Badge>{spaceModuleLabels[booking.module]}</Badge>
                    </div>
                    <p className="text-sm tabular-nums">
                        {booking.date} · {timeLabel(booking.start)}–{timeLabel(booking.end)} ·{' '}
                        {booking.module === 'activity' ? `${booking.quantity} 人` : '整间预约'}
                    </p>
                    <dl className="grid grid-cols-1 gap-3 break-words text-[13px] sm:grid-cols-[80px_minmax(0,1fr)]">
                        <dt className="text-muted-foreground">使用用途</dt>
                        <dd>{booking.purpose}</dd>
                        <dt className="text-muted-foreground">申请人</dt>
                        <dd>
                            {booking.applicantName || user.name} · {booking.studentId || user.studentId}
                        </dd>
                    </dl>
                    <Alert>{booking.message}</Alert>
                    {booking.status === 'confirmed' && (
                        <div className="border-y border-border py-4">
                            <h3 className="text-xs font-medium">开门密码</h3>
                            {slotInstant(booking.date, booking.end) <= Date.now() ? (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    预约已结束，不再展示开门密码。
                                </p>
                            ) : booking.doorCode ? (
                                <p className="mt-3 text-2xl font-medium tracking-[.15em] text-primary">
                                    {booking.doorCode}
                                </p>
                            ) : (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    正在核对开门密码，取得后会自动显示。
                                </p>
                            )}
                        </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] text-muted-foreground">
                            申请号 {booking.id.slice(0, 8)} · {formatSpaceTime(booking.createdAt)}
                        </p>
                        {!['cancelled', 'failed', 'cancel_requested', 'cancelling', 'cancel_uncertain'].includes(
                            booking.status,
                        ) && (
                            <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
                                申请取消
                            </Button>
                        )}
                    </div>
                </Card>
            </DetailLayout>
            <Modal
                open={confirm}
                title="申请取消预约"
                onOpenChange={(open) => {
                    if (!busy) setConfirm(open)
                }}
            >
                <p className="text-[13px] leading-6 text-muted-foreground">
                    {booking.spaceName} · {booking.date} {timeLabel(booking.start)}–{timeLabel(booking.end)}
                    。已受理的预约需要等待官方取消结果核对。
                </p>
                {error && (
                    <Alert tone="danger" className="mt-4">
                        {error}
                    </Alert>
                )}
                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setConfirm(false)} disabled={busy}>
                        保留预约
                    </Button>
                    <Button variant="danger" loading={busy} onClick={() => void cancel()}>
                        确认申请取消
                    </Button>
                </div>
            </Modal>
        </PageLayout>
    )
}
