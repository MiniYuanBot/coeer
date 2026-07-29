import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { SectionHeader } from '@/components/coeer'

export const Route = createFileRoute('/_authed/admin')({
    beforeLoad: ({ context }) => {
        if (context.user?.role !== 'admin') {
            throw new Error('Permission denied')
        }
    },
    errorComponent: ({ error }) => {
        if (error.message === 'Permission denied') {
            throw redirect({ to: '/' })
        }

        throw error
    },
    component: AdminLayout,
})

function AdminLayout() {
    return (
        <div className="space-y-6">
            <SectionHeader
                title="管理工作台"
                description="审核反馈、跟进处理状态，并管理宿舍、活动、商城与成就。"
            />
            <Outlet />
        </div>
    )
}
