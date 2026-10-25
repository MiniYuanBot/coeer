import { createFileRoute } from '@tanstack/react-router'
import { adminGetAchievementFn } from '~/functions'
import { editorSearchSchema } from '../-editor-layout'
import { AchievementForm } from './-form'

export const Route = createFileRoute('/_authed/admin/achievements/$achievementId/edit')({
    validateSearch: editorSearchSchema,
    loader: async ({ params }) => {
        const result = await adminGetAchievementFn({ data: { achievementId: params.achievementId } })
        if (!result.success || !result.data) throw new Error(result.state.message)
        return result.data
    },
    component: EditPage,
})

function EditPage() {
    const record = Route.useLoaderData()
    const { page } = Route.useSearch()
    return <AchievementForm key={record.id} editing={record} page={page} />
}
