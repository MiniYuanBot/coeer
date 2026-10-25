import { createFileRoute } from '@tanstack/react-router'
import { getBulletinByIdFn } from '~/functions'
import { editorSearchSchema } from '../-editor-layout'
import { BulletinForm } from './-form'

export const Route = createFileRoute('/_authed/admin/bulletins/$bulletinId/edit')({
    validateSearch: editorSearchSchema,
    loader: async ({ params }) => {
        const result = await getBulletinByIdFn({ data: { id: params.bulletinId } })
        if (!result.success || !result.data) throw new Error(result.state.message)
        return result.data
    },
    component: EditPage,
})

function EditPage() {
    const record = Route.useLoaderData()
    const { page } = Route.useSearch()
    return <BulletinForm key={record.id} editing={record} page={page} />
}
