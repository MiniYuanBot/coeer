import { createFileRoute, type SearchSchemaInput } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import {
    Alert,
    Badge,
    Button,
    Card,
    EmptyState,
    Field,
    Input,
    LoadingState,
    Modal,
    Pagination,
    SearchInput,
    Select,
    paginate,
} from '@/components/coeer'
import { useSpaceAdmin } from '@/hooks/useSpaceAdmin'
import { bookingStatusTone, formatSpaceTime } from '@/components/coeer/lib/spaces'
import { statusLabels, timeLabel, type Booking } from '@shared/open-space/domain'

export const Route = createFileRoute('/_authed/admin/spaces/bookings')({
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) =>
        z
            .object({
                q: z.string().catch('').default(''),
                status: z.string().catch('all').default('all'),
                page: z.coerce.number().int().min(1).catch(1).default(1),
            })
            .parse(search),
    component: SpaceBookingsAdminPage,
})

function SpaceBookingsAdminPage() {
    const { data, loading, error, pending, mutate } = useSpaceAdmin()
    const filters = Route.useSearch()
    const navigate = Route.useNavigate()
    const update = (values: Partial<typeof filters>) =>
        void navigate({
            search: (previous) => ({ ...previous, ...values, page: values.page ?? 1 }),
            replace: true,
        })
    const rows = paginate(
        (data?.bookings ?? []).filter(
            (booking) =>
                `${booking.spaceName} ${booking.userName} ${booking.studentId} ${booking.id}`.includes(
                    filters.q,
                ) &&
                (filters.status === 'all' ||
                    (filters.status === 'issues'
                        ? ['manual_review', 'uncertain', 'cancel_uncertain'].includes(booking.status)
                        : filters.status === booking.status)),
        ),
        filters.page,
    )
    return (
        <div className="space-y-5">
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-0 flex-1">
                    <SearchInput
                        aria-label="搜索预约"
                        placeholder="搜索空间、姓名、学号或申请号"
                        value={filters.q}
                        onChange={(event) => update({ q: event.target.value })}
                    />
                </div>
                <Field label="预约状态">
                    <Select
                        value={filters.status}
                        onChange={(event) => update({ status: event.target.value })}
                    >
                        <option value="all">全部申请</option>
                        <option value="issues">需人工核对</option>
                        {Object.entries(statusLabels).map(([key, label]) => (
                            <option key={key} value={key}>
                                {label}
                            </option>
                        ))}
                    </Select>
                </Field>
            </div>
            {loading ? (
                <LoadingState />
            ) : rows.total ? (
                rows.items.map((booking) => (
                    <AdminBooking
                        key={booking.id}
                        booking={booking}
                        mock={data?.adapter === 'mock'}
                        pending={pending}
                        mutate={mutate}
                    />
                ))
            ) : (
                <EmptyState title="暂无匹配的申请" description="调整筛选条件，或等待用户提交预约。" />
            )}
            {rows.total > rows.size && <Pagination {...rows} onChange={(page) => update({ page })} />}
        </div>
    )
}

function AdminBooking({
    booking,
    mock,
    pending,
    mutate,
}: {
    booking: Booking
    mock: boolean
    pending: boolean
    mutate: ReturnType<typeof useSpaceAdmin>['mutate']
}) {
    const [confirm, setConfirm] = useState(false)
    const unresolved = ['manual_review', 'uncertain'].includes(booking.status)
    async function resolve(form: HTMLFormElement) {
        const fields = new FormData(form)
        await mutate(
            mock
                ? `/admin/mock/bookings/${booking.id}/resolve`
                : `/admin/bookings/${booking.id}/official-link`,
            mock
                ? { note: fields.get('note') }
                : { note: fields.get('note'), officialRef: fields.get('officialRef') },
        )
    }
    return (
        <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-medium">{booking.spaceName}</h2>
                <Badge tone={bookingStatusTone(booking.status)}>{statusLabels[booking.status]}</Badge>
            </div>
            <p className="text-[13px] tabular-nums">
                {booking.date} · {timeLabel(booking.start)}–{timeLabel(booking.end)} ·{' '}
                {booking.module === 'activity' ? `${booking.quantity} 人` : '整间预约'}
            </p>
            <p className="text-xs text-muted-foreground">
                申请人：{booking.applicantName || booking.userName} · {booking.studentId}
            </p>
            <p className="text-[13px]">用途：{booking.purpose}</p>
            <p className="text-xs leading-6 text-muted-foreground">{booking.message}</p>
            <div className="flex flex-wrap gap-2">
                {booking.status === 'pending_review' && (
                    <>
                        <Button
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                                void mutate(`/admin/bookings/${booking.id}/review`, { decision: 'approve' })
                            }
                        >
                            审核通过
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                                void mutate(`/admin/bookings/${booking.id}/review`, { decision: 'reject' })
                            }
                        >
                            驳回申请
                        </Button>
                    </>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    disabled={pending || booking.status === 'pending_review'}
                    onClick={() =>
                        void mutate(
                            `/admin/bookings/${booking.id}/reconcile`,
                            {},
                            'POST',
                            '核对任务已加入队列',
                        )
                    }
                >
                    手动核对
                </Button>
                {!['failed', 'cancelled', 'cancel_requested', 'cancelling', 'cancel_uncertain'].includes(
                    booking.status,
                ) && (
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirm(true)}>
                        取消预约
                    </Button>
                )}
                {mock && booking.status === 'pending_approval' && (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                                void mutate(`/admin/mock/bookings/${booking.id}/decision`, {
                                    decision: 'approve',
                                })
                            }
                        >
                            模拟审批通过
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                                void mutate(`/admin/mock/bookings/${booking.id}/decision`, {
                                    decision: 'reject',
                                })
                            }
                        >
                            模拟驳回
                        </Button>
                    </>
                )}
                {mock && ['confirmed', 'pending_approval'].includes(booking.status) && (
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                            void mutate(`/admin/mock/bookings/${booking.id}/decision`, { decision: 'cancel' })
                        }
                    >
                        模拟官方取消
                    </Button>
                )}
            </div>
            {unresolved && (
                <form
                    className="space-y-4 border-t border-border pt-4"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void resolve(event.currentTarget)
                    }}
                >
                    {!mock && (
                        <Field label="官方预约编号">
                            <Input name="officialRef" required maxLength={128} pattern="[-A-Za-z0-9_.:]+" />
                        </Field>
                    )}
                    <Field
                        label="核对说明"
                        description="记录至少 8 字的核对依据，请勿填写凭据或人员隐私信息。"
                    >
                        <Input name="note" minLength={8} maxLength={200} required />
                    </Field>
                    <Button type="submit" variant="outline" size="sm" disabled={pending}>
                        {mock ? '确认模拟记录未创建' : '只读核对并关联官方记录'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        仅在证据通过验证后更新状态，不会重新创建预约。
                    </p>
                </form>
            )}
            <p className="break-all text-xs text-muted-foreground">
                申请号 {booking.id} · {formatSpaceTime(booking.createdAt)}
            </p>
            <Modal
                open={confirm}
                title="取消预约"
                onOpenChange={(open) => {
                    if (!pending) setConfirm(open)
                }}
            >
                <p className="text-[13px] leading-6 text-muted-foreground">
                    确认取消 {booking.spaceName} 在 {booking.date} {timeLabel(booking.start)}–
                    {timeLabel(booking.end)} 的预约？结果需等待核对。
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="secondary" disabled={pending} onClick={() => setConfirm(false)}>
                        保留
                    </Button>
                    <Button
                        variant="danger"
                        loading={pending}
                        onClick={() =>
                            void mutate(`/admin/bookings/${booking.id}/cancel`).then((ok) => {
                                if (ok) setConfirm(false)
                            })
                        }
                    >
                        确认取消
                    </Button>
                </div>
            </Modal>
        </Card>
    )
}
