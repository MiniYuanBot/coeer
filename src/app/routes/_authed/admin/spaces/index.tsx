import { createFileRoute, Link } from '@tanstack/react-router'
import { Alert, Badge, Button, Card, LoadingState } from '@/components/coeer'
import { useSpaceAdmin } from '@/hooks/useSpaceAdmin'
import { formatSpaceTime } from '@/components/coeer/lib/spaces'

export const Route = createFileRoute('/_authed/admin/spaces/')({ component: SpaceOverviewPage })

function SpaceOverviewPage() {
    const { data, loading, error, pending, mutate } = useSpaceAdmin()
    if (loading) return <LoadingState />
    if (!data) return <Alert tone="danger">{error || '无法加载管理数据'}</Alert>
    return (
        <div className="space-y-6">
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex flex-wrap gap-2">
                <Button
                    disabled={pending}
                    onClick={() => void mutate('/admin/sync', {}, 'POST', '同步任务已加入队列')}
                >
                    同步空间状态
                </Button>
                <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => void mutate('/admin/settings', { paused: !data.paused }, 'PATCH')}
                >
                    {data.paused ? '恢复自动操作' : '暂停自动操作'}
                </Button>
                {data.adapter === 'official' && (
                    <Button
                        variant="outline"
                        disabled={pending}
                        onClick={() => void mutate('/admin/connector/check')}
                    >
                        检查官方连接
                    </Button>
                )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    ['公开空间', data.spaces.filter((space) => space.published).length],
                    ['预约申请', data.bookings.length],
                    [
                        '待审核 / 审批',
                        data.bookings.filter((booking) =>
                            ['pending_review', 'pending_approval'].includes(booking.status),
                        ).length,
                    ],
                    ['需核对异常', data.operations.manualReview],
                ].map(([label, value]) => (
                    <Card key={label} className="p-5">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-3 text-2xl font-medium tabular-nums">{value}</p>
                    </Card>
                ))}
            </div>
            <Card className="space-y-5 p-5">
                <h2 className="text-sm font-medium">运行状态</h2>
                <dl className="grid gap-x-6 gap-y-4 text-[13px] sm:grid-cols-[120px_1fr]">
                    <dt className="text-muted-foreground">接入环境</dt>
                    <dd>
                        {data.environment} · {data.adapter}
                    </dd>
                    <dt className="text-muted-foreground">任务处理</dt>
                    <dd>
                        <Badge tone={data.paused ? 'warning' : 'success'}>
                            {data.paused ? '已暂停' : '自动运行'}
                        </Badge>
                    </dd>
                    <dt className="text-muted-foreground">任务积压</dt>
                    <dd>{data.operations.queuePending} 项</dd>
                    <dt className="text-muted-foreground">时段缓存</dt>
                    <dd>{data.operations.syncStale ? '数据已过期，等待同步' : '同步状态有效'}</dd>
                    {data.adapterDiagnostics.connector && (
                        <>
                            <dt className="text-muted-foreground">官方认证</dt>
                            <dd>
                                {data.adapterDiagnostics.connector.authentication || '待检查'} ·{' '}
                                {formatSpaceTime(data.adapterDiagnostics.connector.lastSuccessAt)}
                            </dd>
                        </>
                    )}
                </dl>
                <div className="flex flex-wrap gap-5 border-t border-border pt-4 text-xs">
                    {[
                        ['syncEnabled', '同步空间状态'],
                        ['bookingEnabled', '执行创建与取消任务'],
                    ].map(([key, label]) => (
                        <label key={key} className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="accent-primary"
                                checked={key === 'syncEnabled' ? data.syncEnabled : data.bookingEnabled}
                                disabled={pending}
                                onChange={(event) =>
                                    void mutate('/admin/settings', { [key]: event.target.checked }, 'PATCH')
                                }
                            />
                            {label}
                        </label>
                    ))}
                </div>
                <p className="text-xs leading-6 text-muted-foreground">
                    官方结果不明确时仅继续核对，不自动重复创建。新发现的空间默认不公开。
                </p>
                <Button asChild variant="outline" size="sm">
                    <Link to="/admin/spaces/bookings">查看预约与异常</Link>
                </Button>
            </Card>
            <Card className="p-5">
                <h2 className="text-sm font-medium">运行告警</h2>
                <div className="mt-4 divide-y divide-border">
                    {data.alerts
                        .filter((alert) => !alert.ack_at)
                        .map((alert) => (
                            <div
                                key={alert.id}
                                className="flex flex-wrap items-center justify-between gap-3 py-3"
                            >
                                <div>
                                    <p className="text-[13px]">{alert.code}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        出现 {alert.occurrences} 次 · {formatSpaceTime(alert.last_at)}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pending}
                                    onClick={() => void mutate(`/admin/alerts/${alert.id}/ack`)}
                                >
                                    确认告警
                                </Button>
                            </div>
                        ))}
                    {!data.alerts.some((alert) => !alert.ack_at) && (
                        <p className="text-xs text-muted-foreground">暂无未确认告警。</p>
                    )}
                </div>
            </Card>
        </div>
    )
}
