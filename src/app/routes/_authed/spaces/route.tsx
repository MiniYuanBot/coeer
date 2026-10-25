import { SpacesPageHeader } from '@/components/coeer/layout/SpacesPageHeader'
import { createFileRoute, Outlet, type SearchSchemaInput } from '@tanstack/react-router'
import { LoadingState, PageLayout } from '@/components/coeer'
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
    const { config, loading } = useSpaces()
    return <PageLayout>
        {loading || !config ? <SpacesPageHeader title="空间预约" description={loading ? '正在读取空间与预约信息…' : '查看空间状态，跟进预约进度。'} /> : null}
        {loading ? <LoadingState /> : config ? <Outlet /> : null}
    </PageLayout>
}
