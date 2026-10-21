import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Card, Field, Input, SectionHeader } from '@/components/coeer'
import { spaceApi, useSpaces } from '@/hooks/useSpaces'
import { safeRedirect } from '@/components/coeer/lib/redirect'
import type { SpaceSession } from '@shared/contracts/spaces'

export const Route = createFileRoute('/_authed/spaces/identity')({ component: BookingIdentityPage })

function BookingIdentityPage() {
    const { user, updateSession } = useSpaces()
    const { user: communityUser } = Route.useRouteContext()
    const { next } = Route.useSearch()
    const navigate = Route.useNavigate()
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [busy, setBusy] = useState(false)
    async function verify(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy(true)
        setError('')
        const fields = new FormData(event.currentTarget)
        try {
            const session = await spaceApi<SpaceSession>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    studentId: fields.get('studentId'),
                    password: fields.get('password'),
                }),
            })
            updateSession(session)
            const target =
                session.user?.role === 'admin' && communityUser?.role === 'admin' ? '/admin/spaces' : next
            const destination =
                target && /^\/(?:spaces(?:\/|\?|$)|admin\/spaces(?:\/|\?|$))/.test(target)
                    ? safeRedirect(target)
                    : '/spaces/bookings'
            void navigate({ href: destination })
        } catch (error) {
            setError((error as Error).message)
        } finally {
            setBusy(false)
        }
    }
    async function changePassword(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError('')
        setNotice('')
        const form = event.currentTarget
        const fields = new FormData(form)
        if (fields.get('newPassword') !== fields.get('confirmation')) {
            setError('两次输入的新密码不一致')
            return
        }
        setBusy(true)
        try {
            const session = await spaceApi<SpaceSession>('/auth/password', {
                method: 'POST',
                body: JSON.stringify({
                    currentPassword: fields.get('currentPassword'),
                    newPassword: fields.get('newPassword'),
                }),
            })
            updateSession(session)
            form.reset()
            setNotice('预约密码已修改，其他设备的预约会话已退出。')
        } catch (error) {
            setError((error as Error).message)
        } finally {
            setBusy(false)
        }
    }
    async function disconnect() {
        setBusy(true)
        setError('')
        try {
            await spaceApi('/auth/logout', { method: 'POST', body: '{}' })
            updateSession({ user: null, csrf: null })
            setNotice('已解除当前设备的预约身份。')
        } catch (error) {
            setError((error as Error).message)
        } finally {
            setBusy(false)
        }
    }
    return (
        <div className="max-w-2xl space-y-6">
            <SectionHeader
                title="预约身份"
                description="社区账号通过邮箱登录；空间预约仍需验证白名单中的学号账号，验证后自动带入申请人信息。"
            />
            {error && <Alert tone="danger">{error}</Alert>}
            {notice && <Alert tone="success">{notice}</Alert>}
            {user ? (
                <>
                    <Card className="space-y-4 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-medium">{user.name}</h2>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    学号 / 账号：{user.studentId}
                                </p>
                            </div>
                            <Badge tone={user.bookingPermission === 'blocked' ? 'danger' : 'success'}>
                                {user.role === 'admin'
                                    ? '预约管理员'
                                    : user.bookingPermission === 'review'
                                      ? '每次需审核'
                                      : user.bookingPermission === 'blocked'
                                        ? '禁止预约'
                                        : '已验证'}
                            </Badge>
                        </div>
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => void disconnect()}>
                            退出预约身份
                        </Button>
                    </Card>
                    <Card className="space-y-5 p-5">
                        <div>
                            <h2 className="text-sm font-medium">修改预约密码</h2>
                            <p className="mt-2 text-xs leading-6 text-muted-foreground">
                                密码需为 12–128 位，修改后会退出其他设备的预约会话。
                            </p>
                        </div>
                        <form onSubmit={(event) => void changePassword(event)} className="max-w-sm space-y-4">
                            <Field label="当前密码">
                                <Input
                                    name="currentPassword"
                                    type="password"
                                    autoComplete="current-password"
                                    maxLength={128}
                                    required
                                />
                            </Field>
                            <Field label="新密码">
                                <Input
                                    name="newPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    minLength={12}
                                    maxLength={128}
                                    required
                                />
                            </Field>
                            <Field label="确认新密码">
                                <Input
                                    name="confirmation"
                                    type="password"
                                    autoComplete="new-password"
                                    minLength={12}
                                    maxLength={128}
                                    required
                                />
                            </Field>
                            <Button type="submit" loading={busy}>
                                保存密码
                            </Button>
                        </form>
                    </Card>
                </>
            ) : (
                <Card className="p-5">
                    <form onSubmit={(event) => void verify(event)} className="max-w-sm space-y-5">
                        <Field label="学号" description="尚未开通的账号，请联系管理员添加白名单。">
                            <Input
                                name="studentId"
                                inputMode="numeric"
                                autoComplete="username"
                                pattern="[0-9]{10}"
                                minLength={10}
                                maxLength={10}
                                required
                            />
                        </Field>
                        <Field label="预约密码">
                            <Input
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                maxLength={128}
                                required
                            />
                        </Field>
                        <Button type="submit" loading={busy}>
                            验证预约身份
                        </Button>
                    </form>
                </Card>
            )}
        </div>
    )
}
