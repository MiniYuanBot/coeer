import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { useAuthMutations } from '../hooks'
import { AuthForm } from '@/components/ui'
import { ThemeToggle } from '@/components/coeer'
import { safeRedirect } from '@/components/coeer/lib/redirect'

export const Route = createFileRoute('/login')({
    validateSearch: z.object({
        redirect: z.string().optional(),
    }),
    beforeLoad: ({ context }) => {
        // Already signed in → send back to the app.
        if (context.user) {
            throw redirect({ to: '/' })
        }
    },
    component: LoginComp,
})

function LoginComp() {
    const router = useRouter()
    const { loginMutation } = useAuthMutations()
    const { redirect: redirectTo } = Route.useSearch()
    const next = safeRedirect(redirectTo)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        const formData = new FormData(e.currentTarget)
        const email = formData.get('email')
        const password = formData.get('password')

        const result = await loginMutation.mutate({
            data: { email: email as string, password: password as string },
        })

        if (result?.success) {
            await router.invalidate()
            router.navigate({ href: next })
        }
    }

    return (
        <div className="relative min-h-dvh">
            <div className="fixed right-4 top-4 z-40">
                <ThemeToggle />
            </div>
            <AuthForm
                actionText="Login"
                status={loginMutation.status}
                onSubmit={handleSubmit}
                afterSubmit={
                    loginMutation.data && !loginMutation.data.success ? (
                        <div className="text-danger">{loginMutation.data.state.message}</div>
                    ) : null
                }
            />
        </div>
    )
}
