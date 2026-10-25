import { TableScroll } from '@/components/coeer/ui/TableScroll'
import { userRoleLabels } from '@/components/coeer/lib/labels'
import { createFileRoute } from '@tanstack/react-router'
import { Card, SectionHeader } from '@/components/coeer'
import { getUserStatsFn } from '~/functions'

export const Route = createFileRoute('/_authed/admin/stats')({
    loader: async () => getUserStatsFn(),
    component: AdminStatsPage,
})

function AdminStatsPage() {
    const stats = Route.useLoaderData()

    return (
        <div className="space-y-6">
            <SectionHeader title="统计概览" description="所有用户及用户情况的数据概览。" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="全部用户" value={stats.total} />
                <StatCard label="活跃用户" value={stats.active} />
                <StatCard label="停用用户" value={stats.inactive} />
                <StatCard label="学生" value={stats.students} />
                <StatCard label="协管" value={stats.moderators} />
                <StatCard label="管理员" value={stats.admins} />
            </div>
            <Card className="overflow-hidden">
                <TableScroll label="用户统计表">
                    <table className="w-full min-w-[680px] table-fixed text-sm">
                        <colgroup><col className="w-1/4" /><col /><col className="w-28" /><col className="w-36" /></colgroup>
                        <thead className="border-b border-[hsl(var(--border))] bg-muted text-left text-xs text-[hsl(var(--muted-foreground))]">
                            <tr>
                                <th className="px-4 py-3 font-medium">用户</th>
                                <th className="px-4 py-3 font-medium">邮箱</th>
                                <th className="px-4 py-3 font-medium">角色</th>
                                <th className="px-4 py-3 font-medium">创建时间</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[hsl(var(--border))]">
                            {stats.users.map((user) => (
                                <tr key={user.id}>
                                    <td className="break-words px-4 py-3">{user.name || '未命名'}</td>
                                    <td className="break-all px-4 py-3 text-[hsl(var(--muted-foreground))]">{user.email}</td>
                                    <td className="px-4 py-3">{userRoleLabels[user.role] || '未知角色'}</td>
                                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{new Date(user.createdAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableScroll>
            </Card>
        </div>
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
