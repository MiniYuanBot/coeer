import { useEffect, useState, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { Route as CreatePostRoute } from '../../src/app/routes/_authed/groups/$slug/posts/create'
import { Route as EditPostRoute } from '../../src/app/routes/_authed/groups/$slug/posts/$postId/edit'
import { Route as FeedbackRoute } from '../../src/app/routes/_authed/feedbacks/create'
import { Route as BulletinsRoute } from '../../src/app/routes/_authed/admin/bulletins/index'
import { Route as ActivitiesRoute } from '../../src/app/routes/_authed/admin/activities/index'
import { Route as CreateBulletinRoute } from '../../src/app/routes/_authed/admin/bulletins/create'
import { Route as EditBulletinRoute } from '../../src/app/routes/_authed/admin/bulletins/$bulletinId.edit'
import { Route as CreateActivityRoute } from '../../src/app/routes/_authed/admin/activities/create'
import { Route as EditActivityRoute } from '../../src/app/routes/_authed/admin/activities/$activityId.edit'
import { useFixturePath } from './admin-navigation'
import { BulletinCard } from '../../src/app/components/coeer/cards/BulletinCard'
import { ActivityCard } from '../../src/app/components/coeer/cards/ActivityCard'
import { FeedbackCard } from '../../src/app/components/coeer/cards/FeedbackCard'
import { MarkdownEditor } from '../../src/app/components/coeer/ui/MarkdownEditor'
import { UnicodeInput } from '../../src/app/components/coeer/ui/UnicodeInput'
import { activityItems, bulletinItems, initialContent } from './markdown-pages-router'
import { failure, submitted } from './markdown-pages-actions'
import '../../src/app/styles/app.css'

const pages = { createPost: CreatePostRoute, editPost: EditPostRoute, feedback: FeedbackRoute, bulletins: BulletinsRoute, activities: ActivitiesRoute }

function SummaryCards() {
    const content = '**公式摘要** $x_i^2$ [参考资料](https://example.test)\n\n$$\n\\frac{a}{b}\n$$'
    const feedback = { id: 'feedback', title: '反馈摘要', content, createdAt: new Date(), status: 'pending', targetType: 'general' }
    return <div className="grid min-w-0 gap-4">
        <section id="bulletin-card"><BulletinCard bulletin={{ ...bulletinItems[0], createdAt: new Date(), content }} /></section>
        <section id="activity-card"><ActivityCard activity={{ ...activityItems[0], description: content }} /></section>
        <section id="feedback-card"><FeedbackCard feedback={feedback} /></section>
        <section id="feedback-row"><FeedbackCard feedback={feedback} variant="row" /></section>
    </div>
}

function PageFixture() {
    const path = useFixturePath()
    const kind = new URLSearchParams(window.location.search).get('kind') || 'createPost'
    const [, refresh] = useState(0)
    useEffect(() => {
        const update = () => refresh((value) => value + 1)
        window.addEventListener('markdown-submitted', update)
        return () => window.removeEventListener('markdown-submitted', update)
    }, [])
    const adminRoutes = kind === 'bulletins' ? [BulletinsRoute, CreateBulletinRoute, EditBulletinRoute] : [ActivitiesRoute, CreateActivityRoute, EditActivityRoute]
    const route = kind === 'bulletins' || kind === 'activities' ? adminRoutes[path.includes('/create') ? 1 : path.includes('/edit') ? 2 : 0] : pages[kind as keyof typeof pages]
    const Page = (route?.options.component ?? SummaryCards) as ComponentType
    return <main className="coeer-workspace max-w-5xl p-4">
        {kind === 'username' ? <form><label>昵称<UnicodeInput policy="username" name="name" defaultValue="Alice" /></label><button type="submit">保存</button></form> : kind === 'reset' ? <form><MarkdownEditor label="正文" name="content" defaultValue={initialContent} />
            <button type="reset">重置正文</button></form> : <Page key={path} />}
        <output id="submitted-action">{submitted.action}</output>
        <output id="submitted-data">{JSON.stringify(submitted.data)}</output>
        <select aria-label="模拟提交失败" onChange={(event) => { failure.mode = event.target.value }}>
            <option value="">正常提交</option><option value="response">服务器拒绝</option><option value="network">网络中断</option>
        </select>
    </main>
}

createRoot(document.getElementById('root')!).render(<PageFixture />)
