import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Alert, Button, Field, Input, ThemeToggle } from '@/components/coeer'
import { BrandMark } from '@/components/coeer/layout/BrandMark'
import { requestPasswordResetFn } from '~/functions/passwordReset'

export const Route = createFileRoute('/forgot-password')({ component: ForgotPasswordPage })

function ForgotPasswordPage() {
    const [pending, setPending] = useState(false)
    const [notice, setNotice] = useState<{ success: boolean; message: string }>()
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const email = String(new FormData(event.currentTarget).get('email') ?? '')
        setPending(true)
        setNotice(undefined)
        try {
            const result = await requestPasswordResetFn({ data: { email } })
            setNotice({ success: result.success, message: result.state.message ?? '申请失败，请稍后重试' })
        } catch { setNotice({ success: false, message: '申请失败，请稍后重试' }) }
        finally { setPending(false) }
    }
    return <main className="flex min-h-dvh items-center justify-center px-6 py-20">
        <div className="fixed right-4 top-4"><ThemeToggle /></div>
        <div className="w-full max-w-[340px]">
            <Link to="/" className="coeer-focus mx-auto flex w-fit items-center gap-2.5 rounded"><BrandMark className="h-9 w-9 text-primary" /><span className="text-xl font-semibold">COEER</span></Link>
            <h1 className="mt-9 text-center text-2xl font-semibold">找回密码</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">输入注册邮箱，我们会向你发送密码重置链接。链接 30 分钟内有效。</p>
            <form onSubmit={(event) => void submit(event)} className="mt-7 space-y-5">
                <Field label="注册邮箱"><Input name="email" type="email" autoComplete="email" required disabled={pending} /></Field>
                {notice ? <Alert tone={notice.success ? 'success' : 'danger'}>{notice.message}</Alert> : null}
                <Button type="submit" className="w-full" loading={pending}>发送重置邮件</Button>
            </form><p className="mt-6 text-center text-sm"><Link to="/login" className="coeer-focus rounded hover:underline">返回登录</Link></p>
        </div>
    </main>
}
