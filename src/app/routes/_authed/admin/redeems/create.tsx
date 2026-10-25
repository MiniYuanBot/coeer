import { createFileRoute } from '@tanstack/react-router'
import { editorSearchSchema } from '../-editor-layout'
import { RedeemItemForm } from './-form'

export const Route = createFileRoute('/_authed/admin/redeems/create')({
    validateSearch: editorSearchSchema,
    component: CreatePage,
})

function CreatePage() {
    const { page } = Route.useSearch()
    return <RedeemItemForm page={page} />
}
