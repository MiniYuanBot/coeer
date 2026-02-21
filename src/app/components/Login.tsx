import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useMutation } from '../hooks/useMutation'
import { loginFn, signupFn } from '~/api'
import { Auth } from './Auth'

export function Login() {
  const router = useRouter()

  console.log('Login component rendered')

  const loginMutation = useMutation({
    fn: loginFn,
    onSuccess: async (ctx) => {
      console.log('onSuccess called with ctx:', ctx)
      console.log('loginMutation.data before update:', loginMutation.data)

      if (!ctx.data?.error) {
        await router.invalidate()
        router.navigate({ to: '/' })
        return
      }
      console.log('Login failed:', ctx.data?.error)
    },
  })

  const signupMutation = useMutation({
    fn: useServerFn(signupFn),
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    console.log('Login handleSubmit called')
    e.preventDefault() // prevent refresh

    const formData = new FormData(e.currentTarget) // use currentTarget rather than target
    const email = formData.get('email')
    const password = formData.get('password')

    console.log('Form data:', { email, password })

    loginMutation.mutate({
      data: {
        email: email as string,
        password: password as string,
      },
    })
  }

  const handleSignupClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('Signup button clicked')
    e.preventDefault()

    const form = e.currentTarget.form
    if (form) {
      const formData = new FormData(form)
      const email = formData.get('email')
      const password = formData.get('password')

      console.log('Signup form data:', { email, password })

      signupMutation.mutate({
        data: {
          email: email as string,
          password: password as string,
        },
      })
    }
  }

  return (
    <Auth
      actionText="Login"
      status={loginMutation.status}
      onSubmit={handleSubmit}
      afterSubmit={
        loginMutation.data ? (
          <>
            <div className="text-red-400">{loginMutation.data.message}</div>
            {loginMutation.data.userNotFound ? (
              <div>
                <button
                  className="text-blue-500"
                  onClick={handleSignupClick}
                  type="button"
                >
                  Sign up instead?
                </button>
              </div>
            ) : null}
          </>
        ) : null
      }
    />
  )
}
