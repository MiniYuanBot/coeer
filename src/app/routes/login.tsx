import { createFileRoute } from '@tanstack/react-router'
import { Login } from 'src/app/components/Login'

export const Route = createFileRoute('/login')({
  component: LoginComp,
})

function LoginComp() {
  return <Login />
}
