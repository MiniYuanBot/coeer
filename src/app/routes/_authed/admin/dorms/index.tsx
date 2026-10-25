import { DataTable, RowActions, StatusBadge } from '@/components/coeer'
import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { confirmDormFn, computeDormFn, updateDormRoomFn } from '~/functions'
import { Button, EmptyState, Field, Input, Modal, SectionHeader, dormRoomStatusLabels, formatDateTime, useToast } from '@/components/coeer'
import type { DormRoom } from '@shared/contracts'
import { Route as DormRoute } from './route'

export const Route = createFileRoute('/_authed/admin/dorms/')({ component: DormAllocationPage })

function DormAllocationPage() {
    const overview = DormRoute.useLoaderData()
    return <Allocation key={overview?.activeCycle?.id || 'empty'} />
}

function Allocation() {
    const overview = DormRoute.useLoaderData()
    const router = useRouter()
    const { toast } = useToast()
    const [working, setWorking] = useState<string | null>(null)
    const [editingRoom, setEditingRoom] = useState<DormRoom | null>(null)
    const [confirmation, setConfirmation] = useState<'compute' | 'publish' | null>(null)
    const active = overview?.activeCycle
    const rooms = overview?.rooms ?? []
    const submissions = overview?.submissions ?? []
    const members = new Map(submissions.map(item => [item.userId, item.user]))

    async function execute(key: string, action: () => Promise<unknown>, message: string) {
        setWorking(key)
        try {
            await action()
            toast({ title: message, tone: 'success' })
            setEditingRoom(null)
            setConfirmation(null)
            await router.invalidate()
        } catch (error) {
            toast({ title: '操作失败', description: error instanceof Error ? error.message : '请稍后重试', tone: 'danger' })
        } finally { setWorking(null) }
    }
    function submitRoom(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!active || !editingRoom) return
        const form = new FormData(event.currentTarget)
        void execute('room', () => updateDormRoomFn({ data: {
            cycleId: active.id, roomId: editingRoom.id,
            roomCode: String(form.get('roomCode') || editingRoom.roomCode),
            building: String(form.get('building') || '') || undefined,
            floor: form.get('floor') ? Number(form.get('floor')) : undefined,
            members: form.getAll('members').map(String),
        } }), '宿舍调整已保存')
    }
    if (!active) return <EmptyState title="还没有宿舍届次" description="先添加一份届次问卷，收集学生信息后即可执行分配。"
        action={<Button asChild><Link to="/admin/dorms/new">添加问卷</Link></Button>} />

    return <PageLayout>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
                ['已收问卷', overview?.questionnaireCount ?? 0], ['未分配人数', overview?.unassignedCount ?? 0],
                ['分配房间', rooms.length], ['已确认房间', active.confirmedRoomCount],
            ].map(([label, value]) => <div key={label} className="rounded-lg bg-card px-4 py-4">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-2 text-xl font-semibold tabular-nums">{value}</dd>
            </div>)}
        </dl>
        <section aria-label="分配操作" className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 space-y-1">
                <h2 className="text-sm font-medium">生成结果，核对后下发</h2>
                <p className="text-xs leading-6 text-muted-foreground">问卷版本 {active.questionnaireVersion || '默认'} · 创建于 {formatDateTime(active.createdAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button disabled={!!working || !submissions.length} onClick={() => setConfirmation('compute')}>执行分配</Button>
                <Button variant="secondary" disabled={!!working || !rooms.length} onClick={() => setConfirmation('publish')}>确认下发</Button>
                <Button variant="ghost" loading={working === 'refresh'} disabled={!!working} onClick={() => void execute('refresh', async () => {}, '已刷新')}>刷新</Button>
            </div>
        </section>
        <section aria-label="分配结果" className="space-y-4">
            <SectionHeader level="h2" title="分配结果" description="逐间核对房间与成员，需要时点击调整。" />
            <DataTable label="宿舍分配表" rows={rooms} rowKey={room => room.id} emptyTitle="暂无分配结果" emptyDescription={submissions.length ? '问卷已收集，执行分配后可在这里核对房间。' : '当前还没有学生提交问卷，收到问卷后可执行分配。'} columns={[
                { key: 'room', header: '房间', render: room => <><p className="font-medium">{room.roomCode}</p><p className="mt-1 text-xs text-muted-foreground">{room.building || '楼栋待定'} · {room.floor == null ? '楼层待定' : `${room.floor} 层`}</p><p className="mt-1 text-xs text-muted-foreground">{room.poolTag.split('-').map(tag => ({ male: '男生', female: '女生', other: '其他', normal: '普通', longbed: '加长床', lowfloor: '低楼层', barrierfree: '无障碍', medical: '医疗需求' }[tag] || tag)).join(' · ')}</p></> },
                { key: 'members', header: '成员', width: '14rem', render: room => <><ul className="flex flex-wrap gap-2" aria-label="房间成员">{room.members.map(id => <li key={id} className="rounded-md bg-muted px-2 py-1 text-xs">{members.get(id)?.name || members.get(id)?.email || id}</li>)}</ul><p className="mt-1 text-xs text-muted-foreground">{room.members.length} / {room.capacity} 人</p></> },
                { key: 'status', header: '状态', width: '7rem', render: room => <StatusBadge status={room.status} labels={dormRoomStatusLabels} /> },
                { key: 'actions', header: '操作', width: '7rem', align: 'right', render: room => <RowActions><Button size="sm" variant="outline" disabled={!!working} onClick={() => setEditingRoom(room)}>调整</Button></RowActions> },
            ]} />
        </section>
        <Modal open={!!confirmation} title={confirmation === 'compute' ? '执行宿舍分配' : '确认下发结果'} onOpenChange={open => { if (!open && !working) setConfirmation(null) }}>
            <p className="text-sm leading-7 text-muted-foreground">{confirmation === 'compute' ? '将根据当前问卷重新生成房间，已有分配结果及手动调整会被替换。' : '将当前房间分配确认为最终结果，学生可在宿舍服务中查看。请确认房间与成员已核对。'}</p>
            <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" disabled={!!working} onClick={() => setConfirmation(null)}>取消</Button>
                <Button loading={!!working} onClick={() => void execute(confirmation!, () => confirmation === 'compute' ? computeDormFn({ data: { cycleId: active.id } }) : confirmDormFn({ data: { cycleId: active.id } }), confirmation === 'compute' ? '宿舍分配已生成' : '宿舍结果已下发')}>确认</Button>
            </div>
        </Modal>
        <Modal open={!!editingRoom} title="调整宿舍" onOpenChange={open => { if (!open && !working) setEditingRoom(null) }}>
            {editingRoom && <form onSubmit={submitRoom} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="房间号"><Input name="roomCode" required maxLength={100} defaultValue={editingRoom.roomCode} /></Field>
                    <Field label="宿舍楼"><Input name="building" maxLength={100} defaultValue={editingRoom.building || ''} /></Field>
                    <Field label="楼层"><Input name="floor" type="number" step={1} defaultValue={editingRoom.floor ?? ''} /></Field>
                </div>
                <fieldset className="space-y-3">
                    <legend className="text-xs font-medium">房间成员</legend>
                    <div className="max-h-60 space-y-1 overflow-y-auto">
                        {submissions.map(item => <label key={item.userId} className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-muted">
                            <input type="checkbox" name="members" value={item.userId} defaultChecked={editingRoom.members.includes(item.userId)} className="coeer-focus h-4 w-4 accent-primary" />
                            <span className="min-w-0 break-words text-sm">{item.user?.name || item.user?.email || item.userId}<span className="ml-2 text-xs text-muted-foreground">{item.studentNo || item.cohortLabel}</span></span>
                        </label>)}
                    </div>
                </fieldset>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" disabled={!!working} onClick={() => setEditingRoom(null)}>取消</Button>
                    <Button type="submit" loading={working === 'room'}>保存调整</Button>
                </div>
            </form>}
        </Modal>
    </PageLayout>
}
