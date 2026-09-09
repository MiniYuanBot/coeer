import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { useAuthMutations } from '../hooks'
import { AuthForm } from '@/components/ui'
import { ThemeToggle } from '@/components/coeer'
import { safeRedirect } from '@/components/coeer/lib/redirect'

export const Route = createFileRoute('/signup')({
    validateSearch: z.object({
        redirect: z.string().optional(),
    }),
    beforeLoad: ({ context }) => {
        if (context.user) {
            throw redirect({ to: '/' })
        }
    },
    component: SignupComp,
})

function SignupComp() {
    const router = useRouter()
    const { signupMutation } = useAuthMutations()
    const { redirect: redirectTo } = Route.useSearch()
    const next = safeRedirect(redirectTo)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        const formData = new FormData(e.currentTarget)
        const email = formData.get('email')
        const password = formData.get('password')

        const result = await signupMutation.mutate({
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
                actionText="Sign Up"
                status={signupMutation.status}
                onSubmit={handleSubmit}
                afterSubmit={
                    signupMutation.data && !signupMutation.data.success ? (
                        <div className="text-danger">{signupMutation.data.state.message}</div>
                    ) : null
                }
            />
        </div>
    )
}
