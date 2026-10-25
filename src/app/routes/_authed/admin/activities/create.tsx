import { createFileRoute } from '@tanstack/react-router'
import { editorSearchSchema } from '../-editor-layout'
import { ActivityForm } from './-form'

export const Route = createFileRoute('/_authed/admin/activities/create')({
    validateSearch: editorSearchSchema,
    component: CreatePage,
})

function CreatePage() {
    const { page } = Route.useSearch()
    return <ActivityForm page={page} />
}
