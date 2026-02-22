import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/profile')({
    component: ProfileComponent,
})

function ProfileComponent() {
    return (
        <div className="profile-layout">
            <nav className="profile-nav">
                <div className="flex space-x-4 border-b">
                    <a href="/profile" className="px-4 py-2">主页</a>
                    {/* <a href="/profile/edit" className="px-4 py-2">编辑资料</a>
                    <a href="/profile/achievements" className="px-4 py-2">成就</a>
                    <a href="/profile/cards" className="px-4 py-2">卡册</a>
                    <a href="/profile/points" className="px-4 py-2">积分流水</a> */}
                </div>
            </nav>

            <Outlet />
        </div>
    )
}