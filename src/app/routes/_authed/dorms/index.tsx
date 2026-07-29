import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { z } from 'zod'
import { getDormQuestionnaireConfigFn, getDormStudentViewFn, listDormCyclesFn, submitDormQuestionnaireFn } from '~/functions'
import { Badge, Button, Card, EmptyState, FilterPanel, Icon, SectionHeader, dormCycleStatusLabels, formatDateTime, useToast } from '@/components/coeer'
import type { DormCycle, DormQuestionnaire, DormRoom, DormStudentView } from '@shared/contracts'

type DormQuestionConfig = {
    qid: string
    category: string
    dimension: string
    question_text: string
    options: Array<{ label: string; value: string | number }>
    weight: number
    is_hard: boolean
    active: boolean
    value_type: 'scalar' | 'multi' | 'string'
}

type DormStudentLoaderData = {
    cycles: DormCycle[]
    questionConfig: DormQuestionConfig[]
    selectedCycleId?: string
    view?: DormStudentView | null
}

const searchSchema = z.object({
    cycleId: z.string().uuid().optional(),
    mode: z.enum(['status', 'form']).optional(),
    search: z.string().optional(),
})

export const Route = createFileRoute('/_authed/dorms/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }): Promise<DormStudentLoaderData> => {
        const cyclesResult = await listDormCyclesFn({ data: { limit: 20, offset: 0, search: search.search } }) as { items?: DormCycle[] }
        const questionConfig = (await getDormQuestionnaireConfigFn()) as DormQuestionConfig[]
        const cycles = cyclesResult.items ?? []
        const selectedCycleId = search.cycleId ?? cycles.find((item) => ['collecting', 'computed', 'confirmed'].includes(item.status))?.id ?? cycles[0]?.id
        const view = selectedCycleId ? await getDormStudentViewFn({ data: { cycleId: selectedCycleId } }) : null
        return { cycles, questionConfig, selectedCycleId, view }
    },
    component: DormHomePage,
})

function DormHomePage() {
    const { cycles, questionConfig, selectedCycleId, view } = Route.useLoaderData()
    const search = Route.useSearch()
    const navigate = useNavigate()
    const { toast } = useToast()
    const current = view?.cycle
    const questionnaire = view?.questionnaire
    const room = view?.room
    const canEdit = !view || view.status !== 'confirmed'
    const mode = search.mode ?? 'status'

    const groupedQuestions = React.useMemo(() => {
        return questionConfig.reduce<Record<string, DormQuestionConfig[]>>((acc, item) => {
            ;(acc[item.category] ||= []).push(item)
            return acc
        }, {})
    }, [questionConfig])

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!current) return

        const formData = new FormData(e.currentTarget)
        const answers: Record<string, string | number | Array<string | number>> = {}

        questionConfig.forEach((question) => {
            if (question.value_type === 'multi') {
                answers[question.qid] = formData.getAll(question.qid).map((value) => resolveOptionValue(question, String(value)))
                return
            }
            const value = formData.get(question.qid)
            if (value === null || value === '') return
            answers[question.qid] = resolveOptionValue(question, String(value))
        })

        const specialNeeds: Record<string, string | number | boolean | null> = {}
        const maybePush = (key: string, value: string | number | boolean | null | undefined) => {
            if (value !== undefined) specialNeeds[key] = value
        }
        maybePush('extra_long_bed', formData.get('extra_long_bed') === 'on')
        maybePush('low_floor', formData.get('low_floor') === 'on')
        maybePush('barrier_free', formData.get('barrier_free') === 'on')
        maybePush('medical', formData.get('medical') === 'on')
        const allergy = (formData.get('allergy') as string) || ''
        if (allergy) maybePush('allergy', allergy)

        try {
            await submitDormQuestionnaireFn({
                data: {
                    cycleId: current.id,
                    cohortLabel: current.cohortLabel,
                    studentNo: (formData.get('studentNo') as string) || undefined,
                    gender: formData.get('gender') as 'male' | 'female' | 'other',
                    college: (formData.get('college') as string) || undefined,
                    major: (formData.get('major') as string) || undefined,
                    height: formData.get('height') ? Number(formData.get('height')) : undefined,
                    specialNeeds,
                    answers,
                },
            })
            toast({ title: '问卷已提交', description: '管理员确认宿舍后会展示结果。', tone: 'success' })
            navigate({ to: '/dorms', search: { cycleId: current.id } })
        } catch (error) {
            toast({ title: '提交失败', description: error instanceof Error ? error.message : undefined, tone: 'danger' })
        }
    }

    return (
        <div className="space-y-6">
            <SectionHeader
                title="宿舍"
                description="填写新生宿舍问卷，管理员最终确认后再查看分配结果。"
            />

            <FilterPanel
                searchValue={search.search}
                searchPlaceholder="搜索宿舍届次"
                onSearch={(value) => navigate({ to: '/dorms', search: { ...search, search: value || undefined } })}
                groups={[
                    {
                        items: [
                            {
                                key: 'status',
                                label: '问卷状态',
                                active: mode === 'status',
                                onClick: () => navigate({ to: '/dorms', search: { ...search, mode: 'status' } }),
                            },
                            {
                                key: 'form',
                                label: '填写问卷',
                                active: mode === 'form',
                                onClick: () => navigate({ to: '/dorms', search: { ...search, mode: 'form' } }),
                            },
                        ],
                    },
                ]}
            />

            {!current ? (
                <EmptyState title="暂无宿舍届次" description="管理员创建届次后，学生才可以填写问卷。" />
            ) : mode === 'status' ? (
                <div className="space-y-4">
                    <CycleSelectCard
                        cycles={cycles}
                        selectedCycleId={selectedCycleId}
                        onChange={(cycleId) => navigate({ to: '/dorms', search: { ...search, cycleId: cycleId || undefined } })}
                    />
                    <Card className="space-y-4 rounded-xl p-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="primary">{dormCycleStatusLabels[current.status] || current.status}</Badge>
                            <Badge>{current.cohortLabel}</Badge>
                            <Badge>问卷版本 {current.questionnaireVersion || '默认'}</Badge>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <MiniStat label="创建时间" value={formatDateTime(current.createdAt)} />
                            <MiniStat label="问卷提交" value={questionnaire ? '已提交' : '未提交'} />
                            <MiniStat label="分配状态" value={view?.status === 'confirmed' ? '已确认' : '等待中'} />
                            <MiniStat label="最终结果" value={room ? room.roomCode : '等待中'} />
                        </div>
                        {view?.status === 'confirmed' && room ? (
                            <DormResultCard room={room} />
                        ) : (
                            <EmptyState title="分配结果等待中" description="管理员最终确认后，这里才会显示房间结果。" />
                        )}
                    </Card>
                </div>
            ) : (
                <div className="space-y-4">
                    <CycleSelectCard
                        cycles={cycles}
                        selectedCycleId={selectedCycleId}
                        onChange={(cycleId) => navigate({ to: '/dorms', search: { ...search, cycleId: cycleId || undefined } })}
                    />
                    <Card className="space-y-4 rounded-xl p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-medium">填写问卷</div>
                                <div className="text-xs text-[hsl(var(--muted-foreground))]">{questionnaire ? '已有提交记录' : '尚未提交'}</div>
                            </div>
                            <Badge tone={canEdit ? 'warning' : 'success'}>{canEdit ? '可填写' : '已锁定'}</Badge>
                        </div>
                        {canEdit ? (
                            <form onSubmit={submit} className="space-y-5">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Field label="学号"><input name="studentNo" defaultValue={questionnaire?.studentNo || ''} className={fieldClass} /></Field>
                                    <Field label="性别">
                                        <select name="gender" defaultValue={questionnaire?.gender || 'male'} className={fieldClass}>
                                            <option value="male">男</option>
                                            <option value="female">女</option>
                                            <option value="other">其他</option>
                                        </select>
                                    </Field>
                                    <Field label="学院"><input name="college" defaultValue={questionnaire?.college || ''} className={fieldClass} /></Field>
                                    <Field label="专业"><input name="major" defaultValue={questionnaire?.major || ''} className={fieldClass} /></Field>
                                    <Field label="身高"><input name="height" type="number" min={100} max={250} defaultValue={questionnaire?.height ?? ''} className={fieldClass} /></Field>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <CheckField name="extra_long_bed" label="需要加长床" defaultChecked={Boolean(questionnaire?.specialNeeds?.extra_long_bed)} />
                                    <CheckField name="low_floor" label="需要低楼层" defaultChecked={Boolean(questionnaire?.specialNeeds?.low_floor)} />
                                    <CheckField name="barrier_free" label="需要无障碍" defaultChecked={Boolean(questionnaire?.specialNeeds?.barrier_free)} />
                                    <CheckField name="medical" label="有医疗需求" defaultChecked={Boolean(questionnaire?.specialNeeds?.medical)} />
                                </div>
                                <Field label="过敏原">
                                    <input name="allergy" defaultValue={typeof questionnaire?.specialNeeds?.allergy === 'string' ? questionnaire.specialNeeds.allergy : ''} className={fieldClass} />
                                </Field>

                                <div className="space-y-5">
                                    {Object.entries(groupedQuestions).map(([category, items]) => (
                                        <Card key={category} className="rounded-xl border border-[hsl(var(--border)/0.65)] p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-sm font-medium">{category}</div>
                                                <Badge>{items.length} 题</Badge>
                                            </div>
                                            <div className="mt-4 space-y-4">
                                                {items.map((question) => (
                                                    <QuestionBlock key={question.qid} question={question} defaultValue={questionnaire?.answers?.[question.qid]} />
                                                ))}
                                            </div>
                                        </Card>
                                    ))}
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button type="submit"><Icon name="send" /> 提交问卷</Button>
                                </div>
                            </form>
                        ) : (
                            <EmptyState title="问卷已锁定" description="管理员确认结果后，问卷不再可编辑。" />
                        )}
                    </Card>
                </div>
            )}
        </div>
    )
}

function CycleSelectCard({ cycles, selectedCycleId, onChange }: { cycles: DormCycle[]; selectedCycleId?: string; onChange: (cycleId: string) => void }) {
    return (
        <Card className="grid gap-4 p-4 lg:grid-cols-[1fr_18rem] lg:items-end">
            <div>
                <div className="text-sm font-medium">宿舍届次</div>
                <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">复用问卷时请先切换届次，避免看错批次。</p>
            </div>
            <select
                value={selectedCycleId || ''}
                onChange={(e) => onChange(e.target.value)}
                className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm"
            >
                <option value="">选择届次</option>
                {cycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                        {cycle.label} · {cycle.cohortLabel}
                    </option>
                ))}
            </select>
        </Card>
    )
}

function DormResultCard({ room }: { room: DormRoom }) {
    return (
        <Card className="rounded-xl border border-[hsl(var(--border))] p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-medium">你的宿舍结果</div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">管理员已确认分配结果</div>
                </div>
                <Icon name="bed" />
            </div>
            <div className="mt-4 grid gap-2 text-sm">
                <div>房间号：{room.roomCode}</div>
                <div>宿舍楼：{room.building || '待定'}</div>
                <div>楼层：{room.floor ?? '待定'}</div>
                <div>池标签：{room.poolTag}</div>
                <div>人数：{room.members.length} / {room.capacity}</div>
            </div>
        </Card>
    )
}

function QuestionBlock({ question, defaultValue }: { question: DormQuestionConfig; defaultValue?: string | number | Array<string | number> | null }) {
    const isMulti = question.value_type === 'multi'
    const defaultMulti = Array.isArray(defaultValue) ? defaultValue.map(String) : []
    const defaultSingle = defaultValue === undefined || defaultValue === null ? '' : String(defaultValue)

    return (
        <div className="space-y-3 border-t border-[hsl(var(--border)/0.45)] pt-4 first:border-t-0 first:pt-0">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-medium">{question.question_text}</div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{question.dimension}</div>
                </div>
                {question.is_hard ? <Badge tone="warning">硬约束</Badge> : <Badge>权重 {question.weight}</Badge>}
            </div>
            {isMulti ? (
                <div className="grid gap-2 sm:grid-cols-2">
                    {question.options.map((option) => (
                        <label key={String(option.value)} className="flex items-start gap-2 rounded-lg border border-[hsl(var(--border)/0.65)] px-3 py-2 text-sm">
                            <input
                                type="checkbox"
                                name={question.qid}
                                value={String(option.value)}
                                defaultChecked={defaultMulti.includes(String(option.value))}
                                className="mt-1 h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
                            />
                            <span>{option.label}</span>
                        </label>
                    ))}
                </div>
            ) : (
                <select name={question.qid} defaultValue={defaultSingle} className={fieldClass}>
                    <option value="">请选择</option>
                    {question.options.map((option) => (
                        <option key={String(option.value)} value={String(option.value)}>
                            {option.label}
                        </option>
                    ))}
                </select>
            )}
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="text-sm font-medium">{label}</span>
            <div className="mt-2">{children}</div>
        </label>
    )
}

function CheckField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
    return (
        <label className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border)/0.65)] px-3 py-2 text-sm">
            <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]" />
            {label}
        </label>
    )
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-[hsl(var(--border)/0.65)] p-3">
            <div className="text-xs text-[hsl(var(--muted-foreground))]">{label}</div>
            <div className="mt-1 text-sm font-medium">{value}</div>
        </div>
    )
}

function resolveOptionValue(question: DormQuestionConfig, raw: string) {
    const match = question.options.find((item) => String(item.value) === raw)
    return match ? match.value : raw
}

const fieldClass = 'coeer-focus h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm'
