import { loginFn, signupFn } from '../../server/functions'
import { useMutation } from './useMutation'

export function useAuthMutations() {
    const loginMutation = useMutation({ fn: loginFn })
    const signupMutation = useMutation({ fn: signupFn })

    return {
        loginMutation,
        signupMutation,
    }
}
