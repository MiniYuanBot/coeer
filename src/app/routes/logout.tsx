import { createFileRoute } from '@tanstack/react-router'
import { logoutFn } from '../../server/functions'

export const Route = createFileRoute('/logout')({
  preload: false,
  loader: () => logoutFn(),
})
