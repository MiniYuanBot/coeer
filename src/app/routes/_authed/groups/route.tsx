import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Sidebar } from '@/components/basic/SideBar'
import {ButtonLink} from '@/components/ui/Button'

export const Route = createFileRoute('/_authed/groups')({
    component: GroupsLayout,
})
const Sidebaractive="bg-gray-100 text-gray-900"
function GroupsLayout() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex gap-8">
                    <Sidebar>
                        <ButtonLink to="/groups/all" variant="Sidebar" activeClassName={Sidebaractive} size='lg'>All Groups</ButtonLink>
                        <ButtonLink to="/groups/my" variant="Sidebar" activeClassName={Sidebaractive} size='lg'>My Groups</ButtonLink>
                        <ButtonLink to="/groups/create" variant="Sidebar" activeClassName={Sidebaractive} size='lg'>Create Groups</ButtonLink>
                    </Sidebar>
                    <main className="flex-1 min-w-0">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    )
}