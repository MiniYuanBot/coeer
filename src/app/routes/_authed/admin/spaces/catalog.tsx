import { DataTable, RowActions, StatusBadge, VisibilityBadge, Modal } from '@/components/coeer'
import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Field, Input, LoadingState, Select, Textarea } from '@/components/coeer'
import { useSpaceAdmin } from '@/hooks/useSpaceAdmin'
import { scenarioLabels, spaceModuleLabels } from '@/components/coeer/lib/spaces'
import type { Space } from '@shared/open-space/domain'

export const Route = createFileRoute('/_authed/admin/spaces/catalog')({ component: SpaceCatalogPage })

function SpaceCatalogPage() {
    const { data, loading, error, pending, mutate } = useSpaceAdmin()
    const [editingId, setEditingId] = useState<string | null>(null)
    const editing = data?.spaces.find(space => space.id === editingId)
    if (loading) return <LoadingState />
    return (
        <PageLayout>
            {error && <Alert tone="danger">{error}</Alert>}
            <DataTable label="空间配置表" rows={data?.spaces ?? []} rowKey={space => space.id} emptyTitle="暂无空间" columns={[
                { key: 'space', header: '空间', render: space => <><p className="font-medium">{space.name}</p><p className="mt-1 text-xs text-muted-foreground">{space.location} · {space.capacity} 人 · {spaceModuleLabels[space.module]}</p></> },
                { key: 'published', header: '公开性', width: '7rem', render: space => <VisibilityBadge visible={space.published} hiddenLabel="非公开" /> },
                { key: 'bookable', header: '预约状态', width: '8rem', render: space => <StatusBadge status={space.bookable ? 'active' : 'inactive'} labels={{ active: '接受预约', inactive: '暂停预约' }} /> },
                { key: 'actions', header: '操作', width: '7rem', align: 'right', render: space => <RowActions><Button size="sm" variant="outline" onClick={() => setEditingId(space.id)}>编辑</Button></RowActions> },
            ]} />
            <Modal open={!!editing} title="编辑空间" onOpenChange={open => { if (!open && !pending) setEditingId(null) }}>
                {error && <Alert tone="danger">{error}</Alert>}
                {editing && data && <SpaceEditor key={editing.id} space={editing} official={data.adapter === 'official'} pending={pending}
                    scenario={data.scenarios.find(row => row.space_id === editing.id)?.scenario ?? 'success'}
                    save={body => mutate(`/admin/spaces/${editing.id}`, body, 'PATCH')}
                    setScenario={scenario => void mutate(`/admin/mock/scenario/${editing.id}`, { scenario }, 'PATCH')} />}
            </Modal>
        </PageLayout>
    )
}

function SpaceEditor({
    space,
    official,
    pending,
    scenario,
    save,
    setScenario,
}: {
    space: Space
    official: boolean
    pending: boolean
    scenario: string
    save: (body: unknown) => Promise<boolean>
    setScenario: (value: string) => void
}) {
    const followsUpstream = space.policy.kind === 'meeting' && space.policy.rulesSource === 'upstream'
    const [name, setName] = useState(space.name)
    const [description, setDescription] = useState(space.description)
    useEffect(() => {
        setName(space.name)
        setDescription(space.description)
    }, [space.name, space.description])
    return (
        <Card className="space-y-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-medium">{space.name}</h2>
                        <Badge>{spaceModuleLabels[space.module]}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        {space.location} · {space.capacity} 人
                    </p>
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                    <label className="inline-flex items-center gap-2">
                        <input
                            className="accent-primary"
                            type="checkbox"
                            checked={space.published}
                            disabled={pending || followsUpstream || (official && !space.publicationAllowed)}
                            onChange={(event) => void save({ published: event.target.checked })}
                        />
                        公开展示
                    </label>
                    <label className="inline-flex items-center gap-2">
                        <input
                            className="accent-primary"
                            type="checkbox"
                            checked={space.bookable}
                            disabled={
                                pending || followsUpstream ||
                                (official && (space.permission !== 'allowed' || !space.policy.rulesVerified))
                            }
                            onChange={(event) => void save({ bookable: event.target.checked })}
                        />
                        接受预约
                    </label>
                </div>
            </div>
            {followsUpstream ? (
                <Alert>场地信息、开放状态和可预约时段与官方系统同步，具体日期及连续时长由官方系统校验。</Alert>
            ) : official ? (
                <Alert>
                    公开资料由独立白名单管理；
                    {space.publicationAllowed ? '已纳入公开白名单' : '尚未纳入公开白名单'}，空间权限
                    {space.permission === 'allowed' ? '已确认' : '尚未确认'}，预约规则
                    {space.policy.rulesVerified ? '已配置审核契约' : '待验证'}。
                </Alert>
            ) : (
                <>
                    <form
                        className="grid gap-4 sm:grid-cols-2"
                        onSubmit={(event) => {
                            event.preventDefault()
                            void save({ name, description })
                        }}
                    >
                        <Field label="空间名称">
                            <Input
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                minLength={2}
                                maxLength={80}
                                required
                            />
                        </Field>
                        <Field label="公开说明">
                            <Textarea
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                minLength={2}
                                maxLength={500}
                                required
                            />
                        </Field>
                        <Button
                            type="submit"
                            variant="outline"
                            className="justify-self-start"
                            disabled={pending}
                        >
                            保存资料
                        </Button>
                    </form>
                    <Field label="模拟结果场景" className="max-w-sm">
                        <Select
                            value={scenario}
                            disabled={pending}
                            onChange={(event) => setScenario(event.target.value)}
                        >
                            {Object.entries(scenarioLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </Select>
                    </Field>
                </>
            )}
        </Card>
    )
}
