import { createFileRoute } from '@tanstack/react-router'
import { adminGetCardFn } from '~/functions'
import { editorSearchSchema } from '../-editor-layout'
import { CardForm } from './-form'

export const Route = createFileRoute('/_authed/admin/cards/$cardId/edit')({
    validateSearch: editorSearchSchema,
    loader: async ({ params }) => {
        const result = await adminGetCardFn({ data: { cardId: params.cardId } })
        if (!result.success || !result.data) throw new Error(result.state.message)
        return result.data
    },
    component: EditPage,
})

function EditPage() {
    const record = Route.useLoaderData()
    const { page } = Route.useSearch()
    return <CardForm key={record.id} editing={record} page={page} />
}
