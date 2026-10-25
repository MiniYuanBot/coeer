import { DataTable } from '@/components/coeer/ui/DataTable'
import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { userRoleLabels } from '@/components/coeer/lib/labels'
import { createFileRoute } from '@tanstack/react-router'
import { PointAdjustment } from '@/components/coeer/ui/PointAdjustment'
import { useState } from 'react'
import type { User } from '@shared/contracts/users'
import { Card, Button } from '@/components/coeer'
import { getUserStatsFn } from '~/functions'

export const Route = createFileRoute('/_authed/admin/stats')({
    loader: async () => getUserStatsFn(),
    component: AdminStatsPage,
})

function AdminStatsPage() {
    const stats = Route.useLoaderData()
    const [selectedUser, setSelectedUser] = useState<User>()

    return (
        <PageLayout title="统计概览"
            description="查看用户情况，并手动增减用户积分。">

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="全部用户" value={stats.total} />
                <StatCard label="活跃用户" value={stats.active} />
                <StatCard label="停用用户" value={stats.inactive} />
                <StatCard label="学生" value={stats.students} />
                <StatCard label="协管" value={stats.moderators} />
                <StatCard label="管理员" value={stats.admins} />
            </div>
            <DataTable label="用户统计表" rows={stats.users} rowKey={user => user.id} emptyTitle="暂无用户" columns={[
                { key: 'points', header: '积分', render: user => <Button size="sm" variant="outline" onClick={() => setSelectedUser(user)}>调整积分</Button> },
                { key: 'user', header: '用户', render: user => <>{user.name || '未命名'}</> },
                { key: 'email', header: '邮箱', width: '16rem', render: user => <>{user.email}</> },
                { key: 'role', header: '角色', width: '7rem', render: user => <>{userRoleLabels[user.role] || '未知角色'}</> },
                { key: 'createdAt', header: '创建时间', width: '8rem', render: user => <>{new Date(user.createdAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}</> }
            ]} />
            {selectedUser && <PointAdjustment key={selectedUser.id} user={selectedUser} onClose={() => setSelectedUser(undefined)} />}
        </PageLayout>
    )
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <Card className="rounded-lg p-5">
            <p className="text-[13px] text-[hsl(var(--muted-foreground))]">{label}</p>
            <p className="mt-2 text-2xl font-medium tabular-nums">{value}</p>
        </Card>
    )
}
