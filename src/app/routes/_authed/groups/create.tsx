// routes/_authed/groups/create.tsx
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { createGroupFn } from '~/functions/groups'
import { GroupCategories } from '@shared/constants'

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
            category: formData.get('category') as GroupCategories,
            isPublic: formData.get('isPublic') === 'on',
        }

        try {
            const result = await createGroupFn({ data })
            if (!result) {
                throw new Error('Create failed')
            }
            navigate({
                to: '/groups/$slug',
                params: { slug: result.slug }
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Create failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">创建群组</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium mb-1">
                        群组名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                        name="name"
                        required
                        minLength={2}
                        maxLength={100}
                        className="w-full p-2 border rounded-lg"
                        placeholder="例如：人工智能学习小组"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">
                        URL标识 <span className="text-red-500">*</span>
                    </label>
                    <input
                        name="slug"
                        required
                        pattern="[a-z0-9-]+"
                        className="w-full p-2 border rounded-lg"
                        placeholder="例如：ai-study-group"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        只能包含小写字母、数字和连字符，将用于群组访问链接
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">
                        分类 <span className="text-red-500">*</span>
                    </label>
                    <select name="category" required className="w-full p-2 border rounded-lg">
                        <option value="academic">学术</option>
                        <option value="club">社团</option>
                        <option value="project">项目</option>
                        <option value="class">班级</option>
                        <option value="interest">兴趣</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">描述</label>
                    <textarea
                        name="description"
                        maxLength={500}
                        rows={4}
                        className="w-full p-2 border rounded-lg"
                        placeholder="介绍一下这个群组..."
                    />
                </div>

                <div className="flex items-center space-x-2">
                    <input type="checkbox" name="isPublic" id="isPublic" defaultChecked />
                    <label htmlFor="isPublic" className="text-sm">
                        公开群组（任何人都可以加入）
                    </label>
                </div>

                <div className="flex space-x-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? '创建中...' : '创建群组'}
                    </button>
                    <Link
                        to='/groups'
                        className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                    >
                        取消
                    </Link>
                </div>
            </form>
        </div>
    )
}