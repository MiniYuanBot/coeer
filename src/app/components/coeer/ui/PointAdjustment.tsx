import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { adjustUserPointsFn, getAdminPointBalanceFn } from '~/functions/points'
import { Modal } from '../feedback/Modal'
import { Button } from './Button'
import { Field } from './Field'
import { Input } from '@/components/coeer'

export function PointAdjustment({ user, onClose }: { user: { id: string; name: string | null; email: string }; onClose: () => void }) {
    const router = useRouter()
    const [balance, setBalance] = useState<number>()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const request = useRef<{ signature: string; id: string } | undefined>(undefined)
    useEffect(() => {
        let active = true
        void getAdminPointBalanceFn({ data: { userId: user.id } }).then(result => {
            if (active && result.success) setBalance(result.data?.balance)
        }).catch(() => { if (active) setError('余额加载失败，请重新打开') })
        return () => { active = false }
    }, [user.id])
    return <Modal open title={`调整积分 · ${user.name || user.email}`} onOpenChange={open => { if (!open && !pending) onClose() }}>
        <p className="mb-4 text-sm">当前积分：{balance ?? '加载中…'}</p>
        <form className="space-y-4" onSubmit={async event => {
            event.preventDefault()
            if (pending || balance === undefined) return
            const form = new FormData(event.currentTarget)
            const amount = Number(form.get('amount'))
            const reason = String(form.get('reason') ?? '').trim()
            if (!Number.isInteger(amount) || !amount || Math.abs(amount) > 1000000) { setError('请输入非零整数，单次调整不超过 100 万积分'); return }
            if (balance + amount < 0) { setError('扣减后积分不能小于零'); return }
            if (!reason) { setError('请填写调整原因'); return }
            const signature = JSON.stringify([user.id, amount, reason])
            if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() }
            setPending(true); setError('')
            try {
                await adjustUserPointsFn({ data: { userId: user.id, requestId: request.current.id, amount, reason } })
                await router.invalidate(); onClose()
            } catch (error) { setError(error instanceof Error ? error.message : '调整失败，请重试') }
            finally { setPending(false) }
        }}>
            <Field label="调整数量（正数增加，负数扣减）"><Input name="amount" type="number" step={1} min={-1000000} max={1000000} required disabled={pending} /></Field>
            <Field label="调整原因"><Input name="reason" required maxLength={120} disabled={pending} /></Field>
            <p className="text-xs text-muted-foreground">调整将记入积分流水，并通知用户。扣减后的积分不能小于零。</p>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" loading={pending} disabled={balance === undefined}>确认调整</Button>
        </form>
    </Modal>
}
