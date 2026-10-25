import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { createDormCycleFn } from '~/functions'
import { Button, Card, Field, Input, SectionHeader, useToast } from '@/components/coeer'

export const Route = createFileRoute('/_authed/admin/dorms/new')({ component: NewDormQuestionnairePage })

function NewDormQuestionnairePage() {
    const navigate = Route.useNavigate()
    const router = useRouter()
    const { toast } = useToast()
    const [creating, setCreating] = useState(false)
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        setCreating(true)
        try {
            const cycle = await createDormCycleFn({ data: {
                code: String(form.get('code') || ''), label: String(form.get('label') || ''),
                cohortLabel: String(form.get('cohortLabel') || ''),
                questionnaireVersion: String(form.get('questionnaireVersion') || '') || undefined,
            } })
            await router.invalidate()
            toast({ title: '届次问卷已创建', tone: 'success' })
            await navigate({ to: '/admin/dorms/questionnaires', search: { cycleId: cycle?.id } })
        } catch (error) {
            toast({ title: '创建失败', description: error instanceof Error ? error.message : undefined, tone: 'danger' })
        } finally { setCreating(false) }
    }
    return <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
        <Card className="p-5 sm:p-6">
            <form onSubmit={submit} className="max-w-[704px] space-y-6">
                <SectionHeader level="h2" title="添加届次问卷" description="创建新的收集批次，学生按届次填写宿舍问卷。" />
                <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="届次名称"><Input name="label" required maxLength={100} placeholder="例如：2026 新生宿舍" /></Field>
                    <Field label="批次标签"><Input name="cohortLabel" required maxLength={100} placeholder="例如：2026级" /></Field>
                    <Field label="届次代码" description="用于区分不同届次，请使用唯一代码。"><Input name="code" required maxLength={100} placeholder="例如：2026-freshman" /></Field>
                    <Field label="问卷版本（选填）" description="用于标记版本，留空则使用默认标记。"><Input name="questionnaireVersion" maxLength={100} placeholder="例如：2026-v1" /></Field>
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
                    <Button variant="secondary" disabled={creating} onClick={() => void navigate({ to: '/admin/dorms', search: previous => ({ cycleId: previous.cycleId }) })}>取消</Button>
                    <Button type="submit" loading={creating}>创建届次问卷</Button>
                </div>
            </form>
        </Card>
        <aside aria-label="问卷说明" className="space-y-5 py-1 text-[13px] leading-7 text-muted-foreground">
            <h2 className="text-sm font-medium text-foreground">从收集到分配</h2>
            <ol className="list-decimal space-y-3 pl-5">
                <li>创建届次后，学生即可填写该届次的问卷。</li>
                <li>在“问卷记录”核对提交情况。</li>
                <li>前往“执行分配”，核对房间和成员后确认下发。</li>
            </ol>
            <p>各届次沿用现有宿舍问卷题目；版本标记不会改变题目内容。</p>
        </aside>
    </section>
}
