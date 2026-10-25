import { createFileRoute } from '@tanstack/react-router'
import { getActivityByIdFn } from '~/functions'
import { editorSearchSchema } from '../-editor-layout'
import { ActivityForm } from './-form'

export const Route = createFileRoute('/_authed/admin/activities/$activityId/edit')({
    validateSearch: editorSearchSchema,
    loader: async ({ params }) => {
        const result = await getActivityByIdFn({ data: { id: params.activityId } })
        if (!result.success || !result.data) throw new Error(result.state.message)
        return result.data
    },
    component: EditPage,
})

function EditPage() {
    const record = Route.useLoaderData()
    const { page } = Route.useSearch()
    return <ActivityForm key={record.id} editing={record} page={page} />
}
