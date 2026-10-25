import { PageLayout } from '@/components/coeer/ui/PageLayout'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { z } from 'zod'
import { Button, Card } from '@/components/coeer'

export const editorSearchSchema = z.object({ page: z.number().int().min(1).default(1) })
type AdminListPath = '/admin/bulletins' | '/admin/activities' | '/admin/redeems' | '/admin/achievements' | '/admin/cards'

export function AdminEditorLayout({ title, backTo, page, children }: {
    title: string; backTo: AdminListPath; page: number; children: ReactNode
}) {
    return <PageLayout title={title}
            action={<Button asChild variant="outline"><Link to={backTo} search={{ page }}>返回列表</Link></Button>}>

        <Card className="coeer-admin-form p-5">{children}</Card>
    </PageLayout>
}
