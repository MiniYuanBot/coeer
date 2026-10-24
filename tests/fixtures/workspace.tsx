import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Route as Home } from '../../src/app/routes/index'
import { Route as Feedbacks } from '../../src/app/routes/_authed/feedbacks/index'
import { Route as Detail } from '../../src/app/routes/_authed/feedbacks/$feedbackId/index'
import { Route as Profile } from '../../src/app/routes/_authed/profile/index'
import { Route as Spaces } from '../../src/app/routes/_authed/spaces/index'
import { Route as Slots } from '../../src/app/routes/_authed/spaces/$spaceId'
import { Route as Bookings } from '../../src/app/routes/_authed/spaces/bookings/index'
import { Route as Booking } from '../../src/app/routes/_authed/spaces/bookings/$bookingId'
import { Route as Admin } from '../../src/app/routes/_authed/admin/feedbacks/index'
import { Route as Groups } from '../../src/app/routes/_authed/groups/route'
import { AuthForm } from '../../src/app/components/ui/AuthForm'
import { AppShell, Alert, Badge, Button, Card, DetailLayout, EmptyState, Field, Input, LoadingState, Modal, SectionHeader, TableScroll, ToastProvider, useToast } from '../../src/app/components/coeer'
import { Markdown } from '../../src/app/components/coeer/ui/Markdown'
import { AchievementCard } from '../../src/app/components/coeer/cards/AchievementCard'
import { MediaPreview } from '../../src/app/components/coeer/ui/MediaPreview'
import { content, screen, state, user } from './workspace-data'
import '../../src/app/styles/app.css'

function Components() {
    const [open, setOpen] = useState(false)
    const [locked, setLocked] = useState(false)
    const { toast } = useToast()
    return <div className="coeer-page">
        <SectionHeader title="公共组件验证" description="隔离数据，用于验证不同内容状态和覆盖层。" action={<Button onClick={() => setOpen(true)}>打开测试弹窗</Button>} />
        <Card className="space-y-4 p-5">
            <div className="flex flex-wrap gap-3"><Button>主要操作</Button><Button variant="outline">次要操作</Button><Button variant="danger">危险操作</Button><Button disabled>不可用</Button><Button loading>正在提交</Button></div>
            <Field label="示例字段"><Input placeholder="请输入内容" /></Field><Field label="只读字段"><Input value="只读值" readOnly /></Field><Field label="禁用字段"><Input value="暂不可编辑" disabled /></Field><Field label="错误字段"><Input aria-invalid="true" aria-describedby="fixture-field-error" /></Field><p id="fixture-field-error" className="text-sm text-danger">请检查输入的内容。</p>
            <div className="flex flex-wrap gap-2">{(['primary', 'success', 'warning', 'danger'] as const).map(tone => <Badge key={tone} tone={tone}>{tone}</Badge>)}</div>
            <Button variant="secondary" onClick={() => toast({ title: '已保存', tone: 'success' })}>显示成功通知</Button>
            <Alert tone="danger">网络错误，原有输入与数据仍然保留。</Alert>
        </Card>
        <DetailLayout aside={<Card className="p-5">相关信息</Card>}><Card className="p-5"><Markdown content={content} /></Card></DetailLayout>
        <AchievementCard achievement={{ name: '尚未解锁的成就', description: '文字应保持可读', progress: { current: 2, target: 10, percentage: 20 } }} />
        <Card><MediaPreview src="/missing-ui-fixture.png" alt="缺失图片" /></Card>
        <Card><TableScroll label="长表格"><table className="min-w-[900px] text-sm"><thead><tr>{['名称', '状态', '说明', '时间'].map(label => <th key={label} className="p-4 text-left">{label}</th>)}</tr></thead><tbody><tr><td className="p-4">长内容示例</td><td>处理中</td><td>{'说明文字'.repeat(35)}</td><td>2026-10-24</td></tr></tbody></table></TableScroll></Card>
        <LoadingState /><EmptyState title="没有匹配内容" description="请调整筛选条件后再试。" />
        <Modal open={open} title="测试弹窗" onOpenChange={next => { if (!locked) setOpen(next) }}>
            <Field label="弹窗内字段"><Input /></Field>
            <Button className="mt-4" onClick={() => toast({ title: '弹窗操作失败', description: '错误必须在活动弹窗中可见，并保留到用户关闭。', tone: 'danger' })}>显示弹窗错误</Button>
            <Button variant="secondary" className="mt-4" onClick={() => setLocked(!locked)}>{locked ? '解除提交锁定' : '模拟提交锁定'}</Button>
        </Modal>
    </div>
}
const pages: Record<string, any> = { feedbacks: Feedbacks, detail: Detail, profile: Profile, spaces: Spaces, slots: Slots, bookings: Bookings, booking: Booking, admin: Admin, groups: Groups }
const HomeComponent = Home.options.component!
function Fixture() {
    const Component = pages[screen]?.options.component
    if (screen === 'home' || screen === 'guest') return <HomeComponent />
    if (screen === 'auth') return <AuthForm actionText="login" status={state === 'pending' ? 'pending' : 'idle'} onSubmit={() => {}} afterSubmit={state === 'error' ? '邮箱或密码有误，请重新输入。' : undefined} />
    return <AppShell user={user}>{screen === 'components' ? <Components /> : Component ? <Component /> : null}</AppShell>
}
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><ToastProvider><Fixture /></ToastProvider></QueryClientProvider>)
