import { createFileRoute } from '@tanstack/react-router'
import { adminGetRedeemItemFn } from '~/functions'
import { editorSearchSchema } from '../-editor-layout'
import { RedeemItemForm } from './-form'

export const Route = createFileRoute('/_authed/admin/redeems/$itemId/edit')({
    validateSearch: editorSearchSchema,
    loader: async ({ params }) => {
        const result = await adminGetRedeemItemFn({ data: { itemId: params.itemId } })
        if (!result.success || !result.data) throw new Error(result.state.message)
        return result.data
    },
    component: EditPage,
})

function EditPage() {
    const record = Route.useLoaderData()
    const { page } = Route.useSearch()
    return <RedeemItemForm key={record.id} editing={record} page={page} />
}
