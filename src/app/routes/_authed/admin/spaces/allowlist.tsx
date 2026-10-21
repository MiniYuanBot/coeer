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
    SearchInput,
    Select,
    paginate,
} from '@/components/coeer'
import { useSpaceAdmin } from '@/hooks/useSpaceAdmin'
import type { BookingPermission } from '@shared/open-space/domain'

export const Route = createFileRoute('/_authed/admin/spaces/allowlist')({ component: SpaceAllowlistPage })
const labels = { allowed: '自动提交', review: '每次需审核', blocked: '禁止预约' }

function SpaceAllowlistPage() {
    const { data, loading, error, pending, mutate } = useSpaceAdmin()
    const [name, setName] = useState('')
    const [studentId, setStudentId] = useState('')
    const [permission, setPermission] = useState<BookingPermission>('allowed')
    const [query, setQuery] = useState('')
    const [page, setPage] = useState(1)
    const [confirm, setConfirm] = useState<{ id: string; name: string; action: 'remove' | 'reset' } | null>(
        null,
    )
    const rows = paginate(
        (data?.allowlist ?? []).filter((row) => `${row.name} ${row.studentId}`.includes(query.trim())),
        page,
    )
    async function save(event: FormEvent) {
        event.preventDefault()
        if (await mutate(`/admin/allowlist/${studentId}`, { name, bookingPermission: permission }, 'PUT')) {
            setName('')
            setStudentId('')
            setPermission('allowed')
        }
    }
    async function confirmAction() {
        if (!confirm) return
        if (
            await mutate(
                `/admin/allowlist/${confirm.id}${confirm.action === 'reset' ? '/reset-password' : ''}`,
                {},
                confirm.action === 'reset' ? 'POST' : 'DELETE',
            )
        )
            setConfirm(null)
    }
    return (
        <div className="space-y-6">
            <Alert>
                白名单同时控制预约账号的登录和预约权限。新用户的初始密码为“学号@114514”；移除用户会立即撤销其预约会话。
            </Alert>
            {error && <Alert tone="danger">{error}</Alert>}
            <Card className="p-5">
                <form
                    onSubmit={(event) => void save(event)}
                    className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]"
                >
                    <Field label="姓名">
                        <Input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            minLength={1}
                            maxLength={40}
                            required
                        />
                    </Field>
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
            <div className="max-w-sm">
                <SearchInput
                    aria-label="搜索白名单"
                    placeholder="搜索姓名或学号"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value)
                        setPage(1)
                    }}
                />
            </div>
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
                                        setName(row.name)
                                        setStudentId(row.studentId)
                                        setPermission(row.bookingPermission)
                                    }}
                                >
                                    编辑
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pending}
                                    onClick={() =>
                                        setConfirm({ id: row.studentId, name: row.name, action: 'reset' })
                                    }
                                >
                                    重置密码
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={pending}
                                    onClick={() =>
                                        setConfirm({ id: row.studentId, name: row.name, action: 'remove' })
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
                title={confirm?.action === 'reset' ? '重置预约密码' : '移除预约权限'}
                onOpenChange={(open) => {
                    if (!open && !pending) setConfirm(null)
                }}
            >
                <p className="text-[13px] leading-6 text-muted-foreground">
                    {confirm?.name}（{confirm?.id}）
                    {confirm?.action === 'reset'
                        ? '的密码将恢复为初始密码，所有预约会话将退出。'
                        : '将失去预约账号访问权限，已有预约记录会保留。'}
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
