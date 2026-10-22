import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
    Alert,
    Badge,
    Button,
    EmptyState,
    LoadingState,
    Pagination,
    PageLayout,
    SectionHeader,
    paginate,
} from '@/components/coeer'
import { useSpaces, useSpaceResource } from '@/hooks/useSpaces'
import { bookingStatusTone, spaceModuleLabels } from '@/components/coeer/lib/spaces'
import { statusLabels, timeLabel, type Booking } from '@shared/open-space/domain'

export const Route = createFileRoute('/_authed/spaces/bookings/')({ component: MyBookingsPage })

function MyBookingsPage() {
    const { user } = useSpaces()
    const resource = useSpaceResource<Booking[]>(user ? '/bookings' : null, 5000)
    const [requested, setPage] = useState(1)
    const page = paginate(resource.data ?? [], requested)
    return (
        <PageLayout>
            <SectionHeader
                title="我的预约"
                description="查看申请、审批与取消结果，预约进度会自动更新。"
                actionLayout="stack-on-mobile"
                action={
                    <Button asChild>
                        <Link to="/spaces">预约空间</Link>
                    </Button>
                }
            />
            {!user ? (
                <EmptyState
                    title="当前账号暂不能预约"
                    description="请使用学生或管理员账号，或联系管理员检查预约身份。"
                />
            ) : (
                <>
                    {resource.error && <Alert tone="danger">{resource.error}</Alert>}
                    {resource.loading ? (
                        <LoadingState />
                    ) : !resource.data && resource.error ? (
                        <EmptyState title="暂时无法读取预约" description="请稍后重试。" action={<Button variant="outline" onClick={resource.reload}>重新加载</Button>} />
                    ) : page.total ? (
                        <>
                            <div className="coeer-record-list">
                                {page.items.map((booking) => (
                                    <Link
                                        key={booking.id}
                                        to="/spaces/bookings/$bookingId"
                                        params={{ bookingId: booking.id }}
                                        className="coeer-record-row coeer-booking-row coeer-focus"
                                    >
                                        <div className="space-y-2">
                                            <h2 className="text-sm font-medium">{booking.spaceName}</h2>
                                            <p className="text-xs leading-6 text-muted-foreground">{booking.purpose}</p>
                                        </div>
                                        <div className="space-y-2 text-[13px] tabular-nums">
                                            <p>{booking.date} · {timeLabel(booking.start)}–{timeLabel(booking.end)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {spaceModuleLabels[booking.module]} · {booking.module === 'activity' ? `${booking.quantity} 人` : '整间预约'}
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Badge tone={bookingStatusTone(booking.status)}>{statusLabels[booking.status]}</Badge>
                                            <p className="text-xs leading-6 text-muted-foreground">{booking.message}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                            <Pagination {...page} onChange={setPage} />
                        </>
                    ) : (
                        <EmptyState
                            title="还没有预约"
                            description="从空间目录选择空间和时段，提交第一份预约申请。"
                        />
                    )}
                </>
            )}
        </PageLayout>
    )
}
