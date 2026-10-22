import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Card, Field, Icon, Input, PageLayout, Pagination, PointsSummaryCard, SectionHeader } from '@/components/coeer'
import { z } from 'zod'
import { ENGAGEMENT_REWARDS } from '@shared/constants/engagement'
import { changePasswordFn, getMyPointBalanceFn, getMyPointHistoryFn, updateProfileFn } from '~/functions'
import { SettingsSection } from '@/components/coeer/ui/SettingsSection'

export const Route = createFileRoute('/_authed/profile/')({
    validateSearch: z.object({ page: z.number().int().min(1).default(1) }),
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ context, deps: { search } }) => {
        const [balanceResult, historyResult] = await Promise.allSettled([
            getMyPointBalanceFn(),
            getMyPointHistoryFn({ data: { limit: 8, offset: (search.page - 1) * 8 } }),
        ])
        return {
            user: context.user!,
            balance: balanceResult.status === 'fulfilled' ? balanceResult.value.data?.balance ?? 0 : 0,
            history: historyResult.status === 'fulfilled' ? historyResult.value.data?.items ?? [] : [],
            total: historyResult.status === 'fulfilled' ? historyResult.value.data?.total ?? 0 : 0,
        }
    },
    component: ProfileIndexComponent,
})

function ProfileIndexComponent() {
    const { user, balance, history, total } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
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
        <PageLayout>
            <SectionHeader
                title="个人中心"
                description="管理账户资料、密码和积分记录。"
                actionLayout="stack-on-mobile"
                action={<Button asChild variant="outline"><Link to="/logout"><Icon name="logout" />退出登录</Link></Button>}
            />
            <div className="coeer-profile-summary grid gap-4">
                <Card className="flex min-w-0 items-center gap-4 p-4">
                    <div aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary-soft text-xl font-medium text-primary">
                        {(user.name || user.email).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <h2 className="break-words text-sm font-semibold">{user.name || 'COEER 成员'}</h2>
                        <p className="mt-1 break-all text-[13px] text-muted-foreground">{user.email}</p>
                        {user.studentId ? <p className="mt-1 text-[13px] text-muted-foreground">{user.role === 'admin' ? '管理员学号' : '学号'}：{user.studentId}</p> : null}
                        <div className="mt-2"><Badge>{({ student: '学生', moderator: '社区管理员', admin: '平台管理员' })[user.role] || user.role}</Badge></div>
                    </div>
                </Card>

                <PointsSummaryCard balance={balance} />
            </div>

            <div className="coeer-profile-content">
                <div className="coeer-profile-settings">
                    <SettingsSection id="profile-name-title" title="个人资料" description="昵称会显示在社区内容和预约管理中。">
                        <form method="post" onSubmit={(event) => void updateProfile(event)} className="space-y-4">
                            <Field label="昵称">
                                <Input key={user.name} name="name" defaultValue={user.name ?? ''} required maxLength={63} autoComplete="nickname" placeholder="输入你的昵称" disabled={profilePending} />
                            </Field>
                            {profileNotice && <Alert tone={profileNotice.success ? 'success' : 'danger'}>{profileNotice.message}</Alert>}
                            <Button type="submit" loading={profilePending}>保存昵称</Button>
                        </form>
                    </SettingsSection>
                    <SettingsSection id="profile-password-title" title="账户安全" description="修改后所有设备需要重新登录。新密码至少 8 位，不超过 72 字节。">
                        <form method="post" onSubmit={(event) => void changePassword(event)} className="space-y-4">
                            <Field label="当前密码"><Input type="password" name="currentPassword" autoComplete="current-password" required disabled={passwordPending} /></Field>
                            <Field label="新密码"><Input type="password" name="newPassword" autoComplete="new-password" required minLength={8} disabled={passwordPending} /></Field>
                            <Field label="确认新密码"><Input type="password" name="confirmPassword" autoComplete="new-password" required minLength={8} disabled={passwordPending} /></Field>
                            {passwordError && <Alert tone="danger">{passwordError}</Alert>}
                            <Button type="submit" loading={passwordPending}>修改密码并重新登录</Button>
                        </form>
                    </SettingsSection>
                </div>

                <section className="min-w-0 border-t border-border pt-6" aria-labelledby="profile-points-title">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 id="profile-points-title" className="text-sm font-semibold">积分流水</h2>
                    </div>
                    <div className="coeer-record-list">
                        {history.map((item: any) => (
                            <div key={item.id} className="coeer-record-row">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0 space-y-1">
                                        <div className="text-sm font-medium">{item.description || item.source}</div>
                                        <div className="text-xs text-muted-foreground">{item.source}</div>
                                    </div>
                                    <div className={item.amount > 0 ? 'shrink-0 font-medium tabular-nums text-success' : 'shrink-0 font-medium tabular-nums text-danger'}>
                                        {item.amount > 0 ? '+' : ''}{item.amount}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {!history.length ? <p className="py-6 text-sm text-[hsl(var(--muted-foreground))]">暂无积分流水</p> : null}
                    </div>
                    <Pagination total={total} page={page} size={8} onChange={(page) => void navigate({ to: '/profile', search: { page } })} />
                    <div className="mt-6 space-y-2 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                        <h3 className="font-semibold text-foreground">如何获得积分</h3>
                        {Object.entries(ENGAGEMENT_REWARDS).map(([key, rule]) => <p key={key}>{rule.label}：每次 +{rule.amount}，每日最多 {rule.dailyLimit} 次。</p>)}
                        <p>每日额度按北京时间零点重置，活动签到由管理员或主办方确认。</p>
                    </div>
                </section>
            </div>
        </PageLayout>
    )
}
