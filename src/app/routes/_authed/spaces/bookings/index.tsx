import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
    Alert,
    Badge,
    Button,
    EmptyState,
    LoadingState,
    Pagination,
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
        <div className="space-y-6">
            <SectionHeader
                title="我的预约"
                description="查看申请、审批与取消结果，预约进度会自动更新。"
                action={
                    <Button asChild>
                        <Link to="/spaces">预约空间</Link>
                    </Button>
                }
            />
            {!user ? (
                <EmptyState
                    title="尚未验证预约身份"
                    description="使用白名单学号账号验证后，即可查看你的预约记录。"
                    action={
                        <Button asChild>
                            <Link to="/spaces/identity" search={{ next: '/spaces/bookings' }}>
                                验证预约身份
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <>
                    {resource.error && <Alert tone="danger">{resource.error}</Alert>}
                    {resource.loading ? (
                        <LoadingState />
                    ) : page.total ? (
                        <>
                            <div className="divide-y divide-border border-y border-border">
                                {page.items.map((booking) => (
                                    <Link
                                        key={booking.id}
                                        to="/spaces/bookings/$bookingId"
                                        params={{ bookingId: booking.id }}
                                        className="coeer-focus block space-y-3 px-1 py-5 hover:bg-muted/40"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <h2 className="text-sm font-medium">{booking.spaceName}</h2>
                                            <Badge tone={bookingStatusTone(booking.status)}>
                                                {statusLabels[booking.status]}
                                            </Badge>
                                        </div>
                                        <p className="text-[13px] tabular-nums">
                                            {booking.date} · {timeLabel(booking.start)}–
                                            {timeLabel(booking.end)}
                                            <span className="ml-3 text-muted-foreground">
                                                {spaceModuleLabels[booking.module]}
                                                {booking.module === 'activity'
                                                    ? ` · ${booking.quantity} 人`
                                                    : ''}
                                            </span>
                                        </p>
                                        <p className="text-xs text-muted-foreground">{booking.purpose}</p>
                                        <p className="text-xs text-muted-foreground">{booking.message}</p>
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
        </div>
    )
}
