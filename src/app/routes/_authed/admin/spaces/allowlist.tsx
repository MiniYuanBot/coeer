import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
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
    FilterPanel,
    Select,
    paginate,
} from '@/components/coeer'
import { useSpaceAdmin } from '@/hooks/useSpaceAdmin'
import type { BookingPermission } from '@shared/open-space/domain'

export const Route = createFileRoute('/_authed/admin/spaces/allowlist')({ component: SpaceAllowlistPage })
const labels = { allowed: '自动提交', review: '每次需审核', blocked: '禁止预约' }

function SpaceAllowlistPage() {
    const { data, loading, error, pending, mutate } = useSpaceAdmin()
    const [studentId, setStudentId] = useState('')
    const [permission, setPermission] = useState<BookingPermission>('allowed')
    const [query, setQuery] = useState('')
    const [page, setPage] = useState(1)
    const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null)
    const rows = paginate(
        (data?.allowlist ?? []).filter((row) => `${row.name} ${row.studentId}`.includes(query.trim())),
        page,
    )
    async function save(event: FormEvent) {
        event.preventDefault()
        if (await mutate(`/admin/allowlist/${studentId}`, { bookingPermission: permission }, 'PUT')) {
            setStudentId('')
            setPermission('allowed')
        }
    }
    async function confirmAction() {
        if (!confirm) return
        if (
            await mutate(
                `/admin/allowlist/${confirm.id}`,
                {},
                'DELETE',
            )
        )
            setConfirm(null)
    }
    return (
        <div className="space-y-6">
            <Alert>
                输入 10 位学号即可设置预约权限，系统从 COEER 学生邮箱自动识别学号。移除后立即停止新的预约提交，已有记录会保留。
            </Alert>
            {error && <Alert tone="danger">{error}</Alert>}
            <Card className="p-5">
                <form
                    onSubmit={(event) => void save(event)}
                    className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]"
                >
                    <Field label="学号">
                        <Input
                            value={studentId}
                            onChange={(event) => setStudentId(event.target.value)}
                            inputMode="numeric"
                            pattern="[0-9]{10}"
                            minLength={10}
                            maxLength={10}
                            required
                        />
                    </Field>
                    <Field label="预约权限">
                        <Select
                            value={permission}
                            onChange={(event) => setPermission(event.target.value as BookingPermission)}
                        >
                            {Object.entries(labels).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Button type="submit" loading={pending}>
                        保存白名单
                    </Button>
                </form>
            </Card>
            <FilterPanel searchValue={query} searchPlaceholder="搜索昵称或学号" groups={[]}
                onSearch={value => { setQuery(value); setPage(1) }}
                onSearchChange={value => { setQuery(value); setPage(1) }}
                onClear={() => { setQuery(''); setPage(1) }} />
            {loading ? (
                <LoadingState />
            ) : rows.total ? (
                <div className="divide-y divide-border border-y border-border">
                    {rows.items.map((row) => (
                        <div
                            key={row.studentId}
                            className="flex flex-wrap items-center justify-between gap-4 py-4"
                        >
                            <div>
                                <p className="text-sm font-medium">
                                    {row.name}
                                    <span className="ml-3 text-xs font-normal text-muted-foreground">
                                        {row.studentId}
                                    </span>
                                </p>
                                <div className="mt-2">
                                    <Badge
                                        tone={
                                            row.bookingPermission === 'blocked'
                                                ? 'danger'
                                                : row.bookingPermission === 'review'
                                                  ? 'warning'
                                                  : 'success'
                                        }
                                    >
                                        {labels[row.bookingPermission]}
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setStudentId(row.studentId)
                                        setPermission(row.bookingPermission)
                                    }}
                                >
                                    编辑
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={pending}
                                    onClick={() =>
                                        setConfirm({ id: row.studentId, name: row.name })
                                    }
                                >
                                    移除
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState title="暂无匹配用户" description="添加白名单用户，或调整搜索条件。" />
            )}
            {rows.total > rows.size && <Pagination {...rows} onChange={setPage} />}
            <Modal
                open={!!confirm}
                title="移除预约权限"
                onOpenChange={(open) => {
                    if (!open && !pending) setConfirm(null)
                }}
            >
                <p className="text-[13px] leading-6 text-muted-foreground">
                    {confirm?.name}（{confirm?.id}）
                    将无法提交新的预约，已有预约记录会保留。
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="secondary" disabled={pending} onClick={() => setConfirm(null)}>
                        取消
                    </Button>
                    <Button variant="danger" loading={pending} onClick={() => void confirmAction()}>
                        确认
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
