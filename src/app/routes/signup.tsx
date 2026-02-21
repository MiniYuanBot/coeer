import { createFileRoute } from '@tanstack/react-router'
import { useAuthMutations } from '../hooks'
import { Auth } from 'src/app/components'

export const Route = createFileRoute('/signup')({
  component: SignupComp,
})

function SignupComp() {
  const { signupMutation } = useAuthMutations()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault() // prevent refresh

    const formData = new FormData(e.currentTarget) // use currentTarget rather than target
    const email = formData.get('email')
    const password = formData.get('password')

    // console.log('Form data:', { email, password })

    signupMutation.mutate({
      data: {
        email: email as string,
        password: password as string,
      },
    })
  }

  return (
    <Auth
      actionText="Sign Up"
      status={signupMutation.status}
      onSubmit={handleSubmit}
      afterSubmit={
        signupMutation.data?.error ? (
          <>
            <div className="text-red-400">{signupMutation.data.message}</div>
          </>
        ) : null
      }
    />
  )
}
