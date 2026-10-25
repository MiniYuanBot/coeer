import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { createGroupFn } from '~/functions'
import { GroupCategory, GROUP_CATEGORY } from '@shared/constants'
import { Alert, Button, Card, Field, Icon, Input, Select, Textarea } from '@/components/coeer'

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
        <PageLayout title="创建群组"
            description="提交群组名称、分类和简介，创建后将进入审核流程。">

            <Card className="rounded-lg p-5">
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <Alert tone="danger">
                        {error}
                    </Alert>
                )}

                <Field label="群组名称">
                    <Input
                        name="name"
                        required
                        minLength={2}
                        maxLength={100}
                        placeholder="例如：人工智能学习小组"
                    />
                </Field>

                <Field label="群组地址标识" description="只能包含小写字母、数字和连字符，将用于群组访问链接。">
                    <Input
                        name="slug"
                        required
                        pattern="[a-z0-9-]+"
                        placeholder="例如：ai-study-group"
                    />
                </Field>

                <Field label="分类">
                    <Select name="category" required>
                        <option value={GROUP_CATEGORY.CLUB}>社团</option>
                        <option value={GROUP_CATEGORY.COURSE}>课程</option>
                        <option value={GROUP_CATEGORY.INTEREST}>兴趣</option>
                        <option value={GROUP_CATEGORY.ORGANIZATION}>组织</option>
                        <option value={GROUP_CATEGORY.PROJECT}>项目</option>
                    </Select>
                </Field>

                <Field label="描述（选填）">
                    <Textarea
                        name="description"
                        maxLength={500}
                        rows={4}
                        placeholder="介绍一下这个群组..."
                    />
                </Field>

                <div className="flex items-center gap-2">
                    <input type="checkbox" name="isPublic" id="isPublic" defaultChecked className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]" />
                    <label htmlFor="isPublic" className="text-sm">
                        公开群组（在公开目录展示）
                    </label>
                </div>

                <div className="coeer-form-actions">
                    <Button asChild variant="outline"><Link to="/groups">取消</Link></Button>
                    <Button
                        type="submit"
                        loading={loading}
                    >
                        <Icon name="group" /> 创建群组
                    </Button>
                </div>
            </form>
            </Card>
        </PageLayout>
    )
}
