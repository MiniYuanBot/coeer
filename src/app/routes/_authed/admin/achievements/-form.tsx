import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { Achievement as RecordDefinition } from '~/database/schemas/achievements'
import { Button } from '@/components/coeer'
import { AdminEditorLayout } from '../-editor-layout'
import { Field, Input, Select, Textarea } from '@/components/coeer/ui/Field'
import { ImageUploadField, uploadFormImage } from '@/components/coeer/ui/ImageUploadField'
import { CONFIGURABLE_ACHIEVEMENT_CONDITIONS, resolveAchievementCondition, type ConfigurableAchievementCondition } from '@shared/constants'
import { CreateAchievementSchema } from '@shared/contracts/achievements'
import { achievementConditionTypeLabels } from '@/components/coeer'
import { adminCreateAchievementFn, adminUpdateAchievementFn } from '~/functions'
import { z } from 'zod'

export function AchievementForm({ editing, page }: { editing?: RecordDefinition; page: number }) {
    const navigate = useNavigate()
    const router = useRouter()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const [condition, setCondition] = useState<ConfigurableAchievementCondition>(() => editing ? resolveAchievementCondition(editing.conditionType, editing.code) ?? 'registration' : 'registration')
    const finish = async () => {
        await router.invalidate()
        await navigate({ to: '/admin/achievements', search: { page } })
    }

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (pending) return
        setError('')
        const form = new FormData(e.currentTarget)
        const payload = {
            code: (form.get('code') as string).trim() || `ACH_${crypto.randomUUID().replaceAll('-', '')}`,
            name: form.get('name') as string,
            description: form.get('description') as string,
            iconUrl: null,
            isHidden: form.get('isHidden') === 'hidden',
            conditionType: condition,
            conditionValue: Number(form.get('conditionValue')),
        }
        setPending(true)
        try {
            const data = CreateAchievementSchema.parse({ ...payload, iconUrl: await uploadFormImage(form, 'iconUrl') })
            const result = editing?.id ? await adminUpdateAchievementFn({ data: { achievementId: editing.id, ...data } })
                : await adminCreateAchievementFn({ data })
            if (!result.success) throw new Error(result.state.message || '保存成就失败')
            await finish()
        } catch (error) {
            setError(error instanceof z.ZodError ? error.issues[0].message : error instanceof Error ? error.message : '保存成就失败，请重试')
        } finally { setPending(false) }
    }

    return <AdminEditorLayout title={editing ? '编辑成就' : '新建成就'} backTo="/admin/achievements" page={page}>
        {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
                <form onSubmit={submit}>
                    <fieldset disabled={pending} className="grid min-w-0 gap-5">
                        <div className="coeer-admin-form-grid">
                            <Field label="名称">
                                <Input name="name" required maxLength={100} defaultValue={editing?.name} placeholder="成就名称" className="h-10" />
                            </Field>
                            <Field label="成就代码（选填）" description="留空自动生成，用于内部识别。">
                                <Input name="code" maxLength={50} defaultValue={editing?.code} placeholder="留空自动生成" className="h-10" />
                            </Field>
                            <Field label="解锁条件" description={conditionDescriptions[condition]}>
                                <Select name="conditionType" value={condition} onChange={(event) => setCondition(event.target.value as ConfigurableAchievementCondition)} className="h-10">
                                    {CONFIGURABLE_ACHIEVEMENT_CONDITIONS.map((type) => <option key={type} value={type}>{achievementConditionTypeLabels[type]}</option>)}
                                </Select>
                            </Field>
                            <Field label={condition === 'login_days' ? '目标天数' : condition === 'points_earned' ? '目标积分' : '目标数值'}>
                                <Input key={condition} name="conditionValue" required type="number" min={1} max={2147483647} step={1} readOnly={condition === 'registration'}
                                    defaultValue={condition === 'registration' ? 1 : editing && resolveAchievementCondition(editing.conditionType, editing.code) === condition ? editing.conditionValue : condition === 'login_days' ? 100 : condition === 'points_earned' ? 10000 : 1}
                                    className="h-10 read-only:bg-muted read-only:text-muted-foreground" />
                            </Field>
                        </div>
                        <Field label="说明">
                            <Textarea name="description" required defaultValue={editing?.description} placeholder="介绍成就和达成方式" rows={3} />
                        </Field>
                        <Field label="可见性" description="隐藏成就仅在达成后向该用户显示。"><Select name="isHidden" defaultValue={editing?.isHidden ? 'hidden' : 'public'}><option value="public">公开成就</option><option value="hidden">隐藏成就</option></Select></Field>
                        <ImageUploadField name="iconUrl" label="成就图标（选填）" defaultValue={editing?.iconUrl} disabled={pending} preset="achievement" />
                        <div className="coeer-form-actions border-t border-border pt-4">
                            <Button asChild variant="outline"><Link to="/admin/achievements" search={{ page }}>取消</Link></Button>
                            <Button type="submit" loading={pending}>{editing ? '保存成就' : '添加成就'}</Button>
                        </div>
                    </fieldset>
                </form>
    </AdminEditorLayout>
}

const conditionDescriptions: Record<ConfigurableAchievementCondition, string> = {
    registration: '成功注册后自动获得，已有账号也可获得。',
    login_days: '按北京时间统计登录或访问的不同日期，同一天多次登录只计 1 天，无需连续登录。',
    points_earned: '累计历史获得的积分，兑换或抽卡消耗不会减少进度。',
    feedback_count: '按用户提交的反馈总数统计。',
    group_count: '统计用户创建或以管理员身份管理的群组，不含已驳回群组。',
    card_count: '按拥有的不同卡片种类统计，重复卡片不重复计数。',
}
