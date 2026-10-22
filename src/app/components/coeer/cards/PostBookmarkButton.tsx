import { useEffect, useState } from 'react'
import { useNavigate, useRouter, useRouteContext } from '@tanstack/react-router'
import { setBookmarkFn } from '~/functions/bookmarks'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

export function PostBookmarkButton({ post, compact = false }: { post: { id: string; isBookmarked?: boolean }; compact?: boolean }) {
    const { user } = useRouteContext({ from: '__root__' })
    const router = useRouter()
    const navigate = useNavigate()
    const [bookmarked, setBookmarked] = useState(post.isBookmarked ?? false)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    useEffect(() => setBookmarked(post.isBookmarked ?? false), [post.id, post.isBookmarked])
    async function toggle() {
        if (pending) return
        if (!user) { await navigate({ to: '/login', search: { redirect: router.state.location.href } }); return }
        setPending(true)
        setError('')
        try {
            const result = await setBookmarkFn({ data: { postId: post.id, bookmarked: !bookmarked } })
            setBookmarked(result.bookmarked)
            await router.invalidate()
        } catch (error) { setError(error instanceof Error ? error.message : '收藏失败，请重试') }
        finally { setPending(false) }
    }
    return <div>
        <Button variant="ghost" size={compact ? 'xs' : 'sm'} aria-pressed={bookmarked} loading={pending} onClick={() => void toggle()} className={(bookmarked ? 'text-primary ' : '') + (compact ? 'coeer-home-action [&_svg]:h-3.5 [&_svg]:w-3.5' : '')}>
            <Icon name="bookmark" />{bookmarked ? '已收藏' : '收藏'}
        </Button>
        {error ? <p role="alert" className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
}
