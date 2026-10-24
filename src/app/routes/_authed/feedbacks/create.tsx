import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { MarkdownEditor } from '@/components/coeer/ui/MarkdownEditor'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createFeedbackFn } from '~/functions'
import { FeedbackTargetType } from '@shared/constants'
import { useState } from 'react'
import { Alert, Button, Card, DetailLayout, Field, Icon, Input, SectionHeader, Select, useToast } from '@/components/coeer'

export const Route = createFileRoute('/_authed/feedbacks/create')({
    component: CreateFeedbackPage,
})

function CreateFeedbackPage() {
    const navigate = useNavigate()
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        try {
            const result = await createFeedbackFn({
                data: {
                    targetType: formData.get('targetType') as FeedbackTargetType,
                    targetDesc: formData.get('targetDesc') as string || undefined,
                    title: formData.get('title') as string,
                    content: formData.get('content') as string,
                    isAnonymous: formData.get('isAnonymous') === 'on',
                },
            })

            if (!result) throw new Error('Failed to create feedback')
            toast({ title: '反馈已提交', description: '我们会在反馈列表中跟踪处理进度。', tone: 'success' })
            navigate({ to: '/feedbacks' })
        } catch (err) {
            const message = err instanceof Error ? err.message : '提交失败'
            setError(message)
            toast({ title: '提交失败', description: message, tone: 'danger' })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <PageLayout>
            <SectionHeader title="提交反馈" description="清晰描述目标、现象和期待结果，可以帮助处理者更快推进。" />
            <DetailLayout asideLabel="反馈填写提示" aside={
                <section className="space-y-5 rounded-lg border border-border bg-muted p-5">
                    <h2 className="flex items-center gap-2 text-xs font-semibold"><Icon name="feedback" className="h-3.5 w-3.5 text-muted-foreground" />让问题更容易被处理</h2>
                    <ul className="space-y-3 text-[13px] leading-6 text-muted-foreground">
                        <li>用标题概括具体问题或建议。</li>
                        <li>补充发生时间、位置和具体影响。</li>
                        <li>说明你期待的处理结果。</li>
                    </ul>
                    <p className="border-t border-border pt-4 text-xs leading-6 text-muted-foreground">提交后可在“我提交的”中跟进处理进展。</p>
                </section>
            }>
            <Card className="p-5 sm:p-6">
                {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="反馈对象">
                        <Select name="targetType" required>
                            <option value="">选择对象</option>
                            <option value="academic">教学事务</option>
                            <option value="office">办公室</option>
                            <option value="general">通用问题</option>
                        </Select>
                    </Field>

                    <Field label="对象补充（选填）">
                        <Input name="targetDesc" placeholder="例如：选课系统、宿舍网络、活动报名" />
                    </Field>
                    </div>

                    <Field label="标题">
                        <Input name="title" required maxLength={200} placeholder="一句话说明问题" />
                    </Field>

                    <MarkdownEditor label="内容" name="content" required rows={10} maxLength={5000} disabled={isSubmitting}
                        placeholder="描述发生了什么、影响是什么、你期待怎样处理。" />

                    <label className="flex min-h-11 items-center gap-2 text-[13px]">
                        <input name="isAnonymous" type="checkbox" className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]" />
                        匿名提交
                    </label>

                    <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
                        <Button type="button" variant="outline" onClick={() => navigate({ to: '/feedbacks' })}>取消</Button>
                        <Button type="submit" loading={isSubmitting}><Icon name="send" /> 提交反馈</Button>
                    </div>
                </form>
            </Card>
            </DetailLayout>
        </PageLayout>
    )
}
