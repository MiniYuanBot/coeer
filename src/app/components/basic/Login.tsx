import { useAuthMutations } from '../../hooks'
import { AuthForm } from '../ui/AuthForm'

export function Login() {
  const { loginMutation, signupMutation } = useAuthMutations()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault() // prevent refresh

    const formData = new FormData(e.currentTarget) // use currentTarget rather than target
    const email = formData.get('email')
    const password = formData.get('password')

    // console.log('Form data:', { email, password })

    loginMutation.mutate({
      data: {
        email: email as string,
        password: password as string,
      },
    })
  }

  const handleSignupClick = (e: React.MouseEvent<HTMLButtonElement>) => {
   // console.log('Signup button clicked')
    e.preventDefault()

    const form = e.currentTarget.form
    if (form) {
      const formData = new FormData(form)
      const email = formData.get('email')
      const password = formData.get('password')

      //console.log('Signup form data:', { email, password })

      signupMutation.mutate({
        data: {
          email: email as string,
          password: password as string,
        },
      })
    }
  }
  
  const afterSubmitContent = loginMutation.data ? (
    <>
      <div className="text-red-400">{loginMutation.data.state.message}</div>
      {loginMutation.data.state.code === 'USER_NOT_FOUND' && (
        <div>
          <button
            className="text-sm text-blue-400 hover:underline hover:text-blue-600"
            onClick={handleSignupClick}
            type="button"
          >
            Sign up instead?
          </button>
        </div>
      )}
    </>
  ) : null

  return (
    <AuthForm
      actionText="Login"
      status={loginMutation.status}
      onSubmit={handleSubmit}
      afterSubmit={afterSubmitContent}
    />
  )
}
