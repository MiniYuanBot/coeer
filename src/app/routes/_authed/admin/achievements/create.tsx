import { createFileRoute } from '@tanstack/react-router'
import { editorSearchSchema } from '../-editor-layout'
import { AchievementForm } from './-form'

export const Route = createFileRoute('/_authed/admin/achievements/create')({
    validateSearch: editorSearchSchema,
    component: CreatePage,
})

function CreatePage() {
    const { page } = Route.useSearch()
    return <AchievementForm page={page} />
}
