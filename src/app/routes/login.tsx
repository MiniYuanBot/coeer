import { createFileRoute } from '@tanstack/react-router'
import { Login } from 'src/app/components/basic'

export const Route = createFileRoute('/login')({
  component: LoginComp,
})

function LoginComp() {
  return <Login />
}
