import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Field, Input, ThemeToggle } from '@/components/coeer'
import { resetPasswordFn } from '~/functions/passwordReset'

export const Route = createFileRoute('/reset-password')({ component: ResetPasswordPage })

function ResetPasswordPage() {
    const [token, setToken] = useState('')
    const [pending, setPending] = useState(false)
    const [notice, setNotice] = useState<{ success: boolean; message: string }>()
    useEffect(() => { setToken(new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '') }, [])
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const newPassword = String(form.get('newPassword') ?? '')
        if (newPassword !== form.get('confirmPassword')) { setNotice({ success: false, message: '两次输入的新密码不一致' }); return }
        setPending(true)
        setNotice(undefined)
        try {
            const result = await resetPasswordFn({ data: { token, newPassword } })
            setNotice({ success: result.success, message: result.state.message ?? '重置失败，请稍后重试' })
            if (result.success) { setToken(''); window.history.replaceState(window.history.state, '', window.location.pathname) }
        } catch { setNotice({ success: false, message: '重置失败，请检查链接或重新申请' }) }
        finally { setPending(false) }
    }
    return <main className="flex min-h-dvh items-center justify-center px-6 py-20">
        <div className="fixed right-4 top-4"><ThemeToggle /></div>
        <div className="w-full max-w-[340px]"><h1 className="text-2xl font-semibold">设置新密码</h1><p className="mt-3 text-sm text-muted-foreground">重置后，所有设备需要重新登录。</p>
            <form onSubmit={(event) => void submit(event)} className="mt-7 space-y-5">
                <Field label="新密码" description="至少 8 位，不超过 72 字节"><Input name="newPassword" type="password" autoComplete="new-password" minLength={8} required disabled={pending || notice?.success} /></Field>
                <Field label="确认新密码"><Input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required disabled={pending || notice?.success} /></Field>
                {notice ? <Alert tone={notice.success ? 'success' : 'danger'}>{notice.message}</Alert> : !token ? <Alert tone="warning">请从邮件中的重置链接打开此页。</Alert> : null}
                {notice?.success ? <Button asChild className="w-full"><Link to="/login">重新登录</Link></Button> : <Button type="submit" className="w-full" disabled={!token} loading={pending}>重置密码</Button>}
            </form><p className="mt-6 text-center text-sm"><Link to="/forgot-password" className="coeer-focus rounded hover:underline">重新申请重置链接</Link></p>
        </div>
    </main>
}
