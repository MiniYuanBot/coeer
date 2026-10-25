import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { joinGroupFn } from '~/functions'
import { useState } from 'react'
import { Button, Card, Icon } from '@/components/coeer'

export const Route = createFileRoute('/_authed/groups/$slug/')({
    component: GroupHomePage,
})

function GroupHomePage() {
    const { group, isMember, isAdmin, isPending } = Route.useRouteContext()
    const router = useRouter()
    const [isJoining, setIsJoining] = useState(false)
    const [error, setError] = useState('')

    const handleJoin = async () => {
        if (isJoining || isPending) return
        setIsJoining(true)
        setError('')
        try {
            await joinGroupFn({ data: { groupId: group.id } })
            await router.invalidate()
        } catch (error) {
            setError(error instanceof Error ? error.message : '申请失败，请重试')
        } finally {
            setIsJoining(false)
        }
    }

    return (
        <PageLayout>
            <Card className="rounded-lg p-5">
                <h2 className="text-[15px] font-medium">关于群组</h2>
                <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {group.description || '暂无描述'}
                </p>
            </Card>

            <Card className="rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[15px] font-medium">管理员</h2>
                    <Link
                        to="/groups/$slug/members"
                        params={{ slug: group.slug }}
                        className="text-sm text-[hsl(var(--primary))]"
                    >
                        查看全部成员
                    </Link>
                </div>
                <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-sm font-medium text-[hsl(var(--primary))]">
                        {group.creator?.name?.[0] || '?'}
                    </div>
                    <span className="text-[15px] font-medium">{group.creator?.name || '未知用户'}</span>
                </div>
            </Card>

            {!(isMember || isAdmin) && (
                <Card className="rounded-lg p-5 text-center">
                    <p className="mb-4 text-[13px] text-[hsl(var(--muted-foreground))]">{isPending ? '入群申请已提交，等待管理员审核。' : '加入这个群组，参与讨论'}</p>
                    {error ? <p role="alert" className="mb-3 text-sm text-danger">{error}</p> : null}
                    <Button
                        onClick={handleJoin}
                        disabled={isJoining || isPending}
                        loading={isJoining}
                    >
                        <Icon name="group" /> {isPending ? '已申请' : '申请加入'}
                    </Button>
                </Card>
            )}
        </PageLayout>
    )
}
