import { createFileRoute, Link, Outlet, type SearchSchemaInput } from '@tanstack/react-router'
import { Alert, Button, LoadingState, NavTabs, navTabClass, activeNavTabClass } from '@/components/coeer'
import { SpacesProvider, useSpaces } from '@/hooks/useSpaces'
import { spaceSearchSchema } from '@shared/contracts/spaces'

export const Route = createFileRoute('/_authed/spaces')({
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => spaceSearchSchema.parse(search),
    component: function SpacesRoute() {
        return (
            <SpacesProvider>
                <SpacesLayout />
            </SpacesProvider>
        )
    },
})

function SpacesLayout() {
    const { config, user, loading, error, reload } = useSpaces()
    const { user: communityUser } = Route.useRouteContext()
    return (
        <div className="space-y-6">
            <NavTabs label="空间预约">
                <Link
                    to="/spaces"
                    search={{}}
                    activeOptions={{ exact: true }}
                    className={navTabClass}
                    activeProps={{ className: activeNavTabClass }}
                >
                    空间目录
                </Link>
                <Link
                    to="/spaces/bookings"
                    className={navTabClass}
                    activeProps={{ className: activeNavTabClass }}
                >
                    我的预约
                </Link>
                <Link
                    to="/spaces/identity"
                    search={{}}
                    className={navTabClass}
                    activeProps={{ className: activeNavTabClass }}
                >
                    预约身份
                </Link>
                {communityUser?.role === 'admin' && (
                    <Link
                        to="/admin/spaces"
                        className={navTabClass}
                        activeProps={{ className: activeNavTabClass }}
                    >
                        预约管理
                    </Link>
                )}
            </NavTabs>
            {config?.demo && <Alert>演示环境：空间与预约使用模拟数据，不会提交至官方系统。</Alert>}
            {config && !config.writesEnabled && <Alert>当前仅开放空间状态查询，预约提交尚未启用。</Alert>}
            {config?.paused && config.writesEnabled && (
                <Alert tone="warning">自动处理已暂停，提交的申请将在恢复后继续处理。</Alert>
            )}
            {user?.passwordIsDefault && (
                <Alert tone="warning">
                    你正在使用初始预约密码。
                    <Link to="/spaces/identity" className="ml-1 text-primary underline">
                        前往修改
                    </Link>
                </Alert>
            )}
            {error && (
                <Alert tone="danger">
                    {error}
                    <Button variant="ghost" size="sm" onClick={reload}>
                        重试
                    </Button>
                </Alert>
            )}
            {loading ? <LoadingState /> : config ? <Outlet /> : null}
        </div>
    )
}
