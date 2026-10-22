import { useEffect, useState } from 'react'
import { useNavigate, useRouter, useRouteContext } from '@tanstack/react-router'
import { toggleReactionFn } from '~/functions/reactions'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

export function PostLikeButton({ post, compact = false }: { post: { id: string; reactionCount?: number; hasReacted?: boolean }; compact?: boolean }) {
    const { user } = useRouteContext({ from: '__root__' })
    const router = useRouter()
    const navigate = useNavigate()
    const [state, setState] = useState({ count: post.reactionCount ?? 0, reacted: post.hasReacted ?? false })
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    useEffect(() => setState({ count: post.reactionCount ?? 0, reacted: post.hasReacted ?? false }), [post.id, post.reactionCount, post.hasReacted])
    async function toggle() {
        if (!user) { await navigate({ to: '/login', search: { redirect: router.state.location.href } }); return }
        setPending(true)
        setError('')
        try {
            const result = await toggleReactionFn({ data: { targetType: 'group_post', targetId: post.id } })
            if (!result.success || !result.data) throw new Error(result.state.message)
            setState(result.data)
            await router.invalidate()
        } catch (error) { setError(error instanceof Error ? error.message : '点赞失败，请重试') }
        finally { setPending(false) }
    }
    return <div>
        <Button variant="ghost" size={compact ? 'xs' : 'sm'} aria-pressed={state.reacted} aria-label={`${state.reacted ? '取消点赞' : '点赞'}，${state.count} 人点赞`} loading={pending} onClick={() => void toggle()} className={(state.reacted ? 'text-primary ' : '') + (compact ? 'coeer-home-action [&_svg]:h-3.5 [&_svg]:w-3.5' : '')}>
            <Icon name="heart" />{state.reacted ? '已点赞' : '点赞'} <span className="tabular-nums">{state.count}</span>
        </Button>
        {error ? <p role="alert" className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
}
