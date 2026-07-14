import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { createGroupFn } from '~/functions'
import { GroupCategory, GROUP_CATEGORY } from '@shared/constants'
import { Button, Card, Icon, SectionHeader } from '@/components/coeer'

export const Route = createFileRoute('/_authed/groups/create')({
    component: CreateGroupComponent,
})

function CreateGroupComponent() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        const formData = new FormData(e.currentTarget)
        const data = {
            name: formData.get('name') as string,
            slug: formData.get('slug') as string,
            description: (formData.get('description') as string) || undefined,
            category: formData.get('category') as GroupCategory,
            isPublic: formData.get('isPublic') === 'on',
        }

        try {
            const result = await createGroupFn({ data })
            if (!result) {
                throw new Error('Create failed')
            }
            console.debug('Create successful. Wait admin to review.')

            navigate({ to: '/groups' })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Create failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <SectionHeader title="创建群组" description="提交群组名称、分类和简介，创建后将进入审核流程。" />

            <Card className="rounded-xl p-5">
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
                        {error}
                    </div>
                )}

                <div>
                    <label className="mb-2 block text-sm font-medium">
                        群组名称 <span className="text-rose-500">*</span>
                    </label>
                    <input
                        name="name"
                        required
                        minLength={2}
                        maxLength={100}
                        className="coeer-focus h-11 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm"
                        placeholder="例如：人工智能学习小组"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">
                        URL 标识 <span className="text-rose-500">*</span>
                    </label>
                    <input
                        name="slug"
                        required
                        pattern="[a-z0-9-]+"
                        className="coeer-focus h-11 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm"
                        placeholder="例如：ai-study-group"
                    />
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        只能包含小写字母、数字和连字符，将用于群组访问链接
                    </p>
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">
                        分类 <span className="text-rose-500">*</span>
                    </label>
                    <select name="category" required className="coeer-focus h-11 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">
                        <option value={GROUP_CATEGORY.CLUB}>社团</option>
                        <option value={GROUP_CATEGORY.COURSE}>课程</option>
                        <option value={GROUP_CATEGORY.INTEREST}>兴趣</option>
                        <option value={GROUP_CATEGORY.ORGANIZATION}>组织</option>
                        <option value={GROUP_CATEGORY.PROJECT}>项目</option>
                    </select>
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">描述</label>
                    <textarea
                        name="description"
                        maxLength={500}
                        rows={4}
                        className="coeer-focus w-full resize-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-3 text-sm leading-6"
                        placeholder="介绍一下这个群组..."
                    />
                </div>

                <div className="flex items-center gap-2">
                    <input type="checkbox" name="isPublic" id="isPublic" defaultChecked className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]" />
                    <label htmlFor="isPublic" className="text-sm">
                        公开群组（任何人都可以加入）
                    </label>
                </div>

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                    <Button
                        type="submit"
                        loading={loading}
                    >
                        <Icon name="group" /> 创建群组
                    </Button>
                    <Link
                        to='/groups'
                        className="coeer-focus inline-flex h-10 items-center rounded-lg border border-[hsl(var(--border))] px-4 text-sm font-medium hover:bg-[hsl(var(--muted))]"
                    >
                        取消
                    </Link>
                </div>
            </form>
            </Card>
        </div>
    )
}
