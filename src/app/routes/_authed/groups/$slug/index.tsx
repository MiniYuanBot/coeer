import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { joinGroupFn } from '~/functions'
import { useState } from 'react'
import { Button, Card, Icon, SectionHeader } from '@/components/coeer'


export const Route = createFileRoute('/_authed/groups/$slug/')({
    component: GroupHomePage,
})

function GroupHomePage() {
    const { group, isMember, isAdmin } = Route.useRouteContext()
    const navigate = useNavigate()
    const [isJoining, setIsJoining] = useState(false)

    const handleJoin = async () => {
        setIsJoining(true)
        try {
            await joinGroupFn({ data: { groupId: group.id } })
            // refresh
            navigate({
                to: '/groups/$slug',
                params: { slug: group.slug },
            })
        } finally {
            setIsJoining(false)
        }
    }

    return (
        <div className="space-y-6">
            <Card className="rounded-xl p-5">
                <h2 className="text-[15px] font-medium">关于群组</h2>
                <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {group.description || '暂无描述'}
                </p>
            </Card>

            <Card className="rounded-xl p-5">
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
                    <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-sm font-medium text-[hsl(var(--primary))]">
                        {group.creator?.name?.[0] || '?'}
                    </div>
                    <span className="text-[15px] font-medium">{group.creator?.name || '未知用户'}</span>
                </div>
            </Card>

            {!(isMember || isAdmin) && (
                <Card className="rounded-xl p-5 text-center">
                    <p className="mb-4 text-[13px] text-[hsl(var(--muted-foreground))]">加入这个群组，参与讨论</p>
                    <Button
                        onClick={handleJoin}
                        disabled={isJoining}
                        loading={isJoining}
                    >
                        <Icon name="group" /> 申请加入
                    </Button>
                </Card>
            )}
        </div>
    )
}
