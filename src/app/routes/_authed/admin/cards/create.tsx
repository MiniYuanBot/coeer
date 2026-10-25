import { createFileRoute } from '@tanstack/react-router'
import { editorSearchSchema } from '../-editor-layout'
import { CardForm } from './-form'

export const Route = createFileRoute('/_authed/admin/cards/create')({
    validateSearch: editorSearchSchema,
    component: CreatePage,
})

function CreatePage() {
    const { page } = Route.useSearch()
    return <CardForm page={page} />
}
