import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import {
    Alert,
    Button,
    EmptyState,
    LoadingState,
    NavTabs,
    SectionHeader,
    navTabClass,
    activeNavTabClass,
} from '@/components/coeer'
import { SpacesProvider, useSpaces } from '@/hooks/useSpaces'

export const Route = createFileRoute('/_authed/admin/spaces')({
    component: function SpaceAdminRoute() {
        return (
            <SpacesProvider>
                <SpaceAdminLayout />
            </SpacesProvider>
        )
    },
})

function SpaceAdminLayout() {
    const { config, user, loading, error, reload } = useSpaces()
    return (
        <div className="space-y-6">
            <SectionHeader
                title="空间与预约管理"
                description="管理预约权限、空间配置和处理进度，官方结果不明确时由管理员核对。"
                action={
                    <Button asChild variant="outline">
                        <Link to="/spaces">查看空间目录</Link>
                    </Button>
                }
            />
            <NavTabs label="空间管理">
                <Link
                    to="/admin/spaces"
                    activeOptions={{ exact: true }}
                    className={navTabClass}
                    activeProps={{ className: activeNavTabClass }}
                >
                    运行概览
                </Link>
                <Link
                    to="/admin/spaces/catalog"
                    className={navTabClass}
                    activeProps={{ className: activeNavTabClass }}
                >
                    空间配置
                </Link>
                <Link
                    to="/admin/spaces/bookings"
                    className={navTabClass}
                    activeProps={{ className: activeNavTabClass }}
                >
                    预约与异常
                </Link>
                <Link
                    to="/admin/spaces/allowlist"
                    className={navTabClass}
                    activeProps={{ className: activeNavTabClass }}
                >
                    预约白名单
                </Link>
                <Link
                    to="/admin/spaces/history"
                    className={navTabClass}
                    activeProps={{ className: activeNavTabClass }}
                >
                    任务与审计
                </Link>
            </NavTabs>
            {config?.demo && <Alert>当前为模拟预约环境，操作不会提交至官方系统。</Alert>}
            {error && (
                <Alert tone="danger">
                    {error}
                    <Button variant="ghost" size="sm" onClick={reload}>
                        重试
                    </Button>
                </Alert>
            )}
            {loading ? (
                <LoadingState />
            ) : user?.role !== 'admin' ? (
                <EmptyState
                    title="无法读取管理员权限"
                    description="请刷新页面重试，预约管理直接使用 COEER 管理员权限。"
                />
            ) : (
                <Outlet />
            )}
        </div>
    )
}
