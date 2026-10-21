import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Card, Field, Icon, Input, PageLayout, PointsSummaryCard, SectionHeader } from '@/components/coeer'
import { changePasswordFn, getMyPointBalanceFn, getMyPointHistoryFn, updateProfileFn } from '~/functions'

export const Route = createFileRoute('/_authed/profile/')({
    loader: async ({ context }) => {
        const [balanceResult, historyResult] = await Promise.allSettled([
            getMyPointBalanceFn(),
            getMyPointHistoryFn({ data: { limit: 8, offset: 0 } }),
        ])
        return {
            user: context.user!,
            balance: balanceResult.status === 'fulfilled' ? balanceResult.value.data?.balance ?? 0 : 0,
            history: historyResult.status === 'fulfilled' ? historyResult.value.data?.items ?? [] : [],
        }
    },
    component: ProfileIndexComponent,
})

function ProfileIndexComponent() {
    const { user, balance, history } = Route.useLoaderData()
    const router = useRouter()
    const [profilePending, setProfilePending] = useState(false)
    const [passwordPending, setPasswordPending] = useState(false)
    const [profileNotice, setProfileNotice] = useState<{ success: boolean; message: string }>()
    const [passwordError, setPasswordError] = useState<string>()

    async function updateProfile(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        setProfilePending(true)
        setProfileNotice(undefined)
        try {
            const result = await updateProfileFn({ data: { name: String(data.get('name') ?? '') } })
            setProfileNotice({ success: result.success, message: result.state.message ?? '更新失败，请稍后再试' })
            if (result.success) await router.invalidate()
        } catch {
            setProfileNotice({ success: false, message: '昵称更新失败，请检查输入或稍后再试' })
        } finally {
            setProfilePending(false)
        }
    }

    async function changePassword(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const newPassword = String(data.get('newPassword') ?? '')
        if (newPassword !== data.get('confirmPassword')) {
            setPasswordError('两次输入的新密码不一致')
            return
        }
        setPasswordPending(true)
        setPasswordError(undefined)
        try {
            const result = await changePasswordFn({ data: { currentPassword: String(data.get('currentPassword') ?? ''), newPassword } })
            if (!result.success) {
                setPasswordError(result.state.message ?? '密码修改失败，请稍后再试')
                return
            }
            await router.invalidate()
            await router.navigate({ to: '/login', search: { redirect: '/profile' } })
        } catch {
            setPasswordError('密码修改失败，请检查输入或稍后再试')
        } finally {
            setPasswordPending(false)
        }
    }

    return (
        <PageLayout width="reading">
            <SectionHeader
                title="个人中心"
                description="管理账户资料、密码和积分记录。"
                action={<Button asChild variant="outline"><Link to="/logout"><Icon name="logout" />退出登录</Link></Button>}
            />
            <div className="coeer-profile-summary grid gap-4">
                <Card className="flex items-center p-5">
                    <div className="flex items-center gap-4">
                        <div className="grid h-12 w-12 place-items-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-xl font-medium text-[hsl(var(--primary))]">
                            {(user.name || user.email).slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-[15px] font-medium">{user.name || 'COEER 成员'}</h2>
                            <p className="mt-1 break-all text-[13px] text-muted-foreground">{user.email}</p>
                            <div className="mt-2"><Badge>{({ student: '学生', moderator: '社区管理员', admin: '平台管理员' })[user.role] || user.role}</Badge></div>
                        </div>
                    </div>

                </Card>

                <PointsSummaryCard balance={balance} />
            </div>

            <div>
                <section className="coeer-settings-section" aria-labelledby="profile-name-title">
                    <div>
                    <h2 id="profile-name-title" className="text-sm font-semibold">个人资料</h2>
                    <p className="mt-2 text-[13px] leading-6 text-muted-foreground">昵称会显示在社区内容和预约管理中。</p>
                    </div>
                    <form method="post" onSubmit={(event) => void updateProfile(event)} className="space-y-4">
                        <Field label="昵称">
                            <Input key={user.name} name="name" defaultValue={user.name ?? ''} required maxLength={63} autoComplete="nickname" placeholder="输入你的昵称" disabled={profilePending} />
                        </Field>
                        {profileNotice && <Alert tone={profileNotice.success ? 'success' : 'danger'}>{profileNotice.message}</Alert>}
                        <Button type="submit" loading={profilePending}>保存昵称</Button>
                    </form>
                </section>
                <section className="coeer-settings-section" aria-labelledby="profile-password-title">
                    <div>
                    <h2 id="profile-password-title" className="text-sm font-semibold">账户安全</h2>
                    <p className="mt-2 text-[13px] leading-6 text-muted-foreground">修改后所有设备需要重新登录。新密码至少 8 位，不超过 72 字节。</p>
                    </div>
                    <form method="post" onSubmit={(event) => void changePassword(event)} className="space-y-4">
                        <Field label="当前密码"><Input type="password" name="currentPassword" autoComplete="current-password" required disabled={passwordPending} /></Field>
                        <Field label="新密码"><Input type="password" name="newPassword" autoComplete="new-password" required minLength={8} disabled={passwordPending} /></Field>
                        <Field label="确认新密码"><Input type="password" name="confirmPassword" autoComplete="new-password" required minLength={8} disabled={passwordPending} /></Field>
                        {passwordError && <Alert tone="danger">{passwordError}</Alert>}
                        <Button type="submit" loading={passwordPending}>修改密码并重新登录</Button>
                    </form>
                </section>
            </div>

            <section className="border-t border-border pt-6" aria-labelledby="profile-points-title">
                <div className="mb-4 flex items-center justify-between">
                    <h2 id="profile-points-title" className="text-sm font-semibold">最近积分流水</h2>
                    <Badge>{history.length} 条</Badge>
                </div>
                <div className="divide-y divide-[hsl(var(--border)/0.65)]">
                    {history.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                            <div>
                                <div className="text-sm font-medium">{item.description || item.source}</div>
                                <div className="text-xs text-[hsl(var(--muted-foreground))]">{item.source}</div>
                            </div>
                            <div className={item.amount > 0 ? 'shrink-0 font-medium tabular-nums text-success' : 'shrink-0 font-medium tabular-nums text-danger'}>
                                {item.amount > 0 ? '+' : ''}{item.amount}
                            </div>
                        </div>
                    ))}
                    {!history.length ? <p className="py-6 text-sm text-[hsl(var(--muted-foreground))]">暂无积分流水</p> : null}
                </div>
            </section>
        </PageLayout>
    )
}
