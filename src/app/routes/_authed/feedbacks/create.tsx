import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createFeedbackFn } from '~/functions'
import { FeedbackTargetType } from '@shared/constants'
import { useState } from 'react'
import { Badge, Button, Card, Icon, SectionHeader, useToast } from '@/components/coeer'

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
        <div className="mx-auto max-w-3xl space-y-6">
            <SectionHeader title="提交反馈" description="清晰描述目标、现象和期待结果，可以帮助处理者更快推进。" />
            <Card className="rounded-xl p-5">
                <div className="mb-6 flex flex-wrap gap-2">
                    <Badge tone="primary">问题</Badge>
                    <Badge>建议</Badge>
                    <Badge>事务</Badge>
                </div>
                {error ? <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">{error}</div> : null}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <label className="block">
                        <span className="text-sm font-medium">反馈对象</span>
                        <select name="targetType" required className="coeer-focus mt-2 h-11 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">
                            <option value="">选择对象</option>
                            <option value="academic">教学事务</option>
                            <option value="office">办公室</option>
                            <option value="general">通用问题</option>
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium">对象补充</span>
                        <input name="targetDesc" placeholder="例如：选课系统、宿舍网络、活动报名" className="coeer-focus mt-2 h-11 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium">标题</span>
                        <input name="title" required maxLength={200} placeholder="一句话说明问题" className="coeer-focus mt-2 h-11 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium">内容</span>
                        <textarea name="content" required rows={7} maxLength={5000} placeholder="描述发生了什么、影响是什么、你期待怎样处理。" className="coeer-focus mt-2 w-full resize-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-3 text-sm leading-6" />
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                        <input name="isAnonymous" type="checkbox" className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]" />
                        匿名提交
                    </label>

                    <div className="flex flex-wrap justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={() => navigate({ to: '/feedbacks' })}>取消</Button>
                        <Button type="submit" loading={isSubmitting}><Icon name="send" /> 提交反馈</Button>
                    </div>
                </form>
            </Card>
        </div>
    )
}
