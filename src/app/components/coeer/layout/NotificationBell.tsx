import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getUnreadNotificationCountFn } from '~/functions/notifications'
import { Icon } from '../ui/Icon'

export function NotificationBell({ userId }: { userId: string }) {
    const { data: count = 0 } = useQuery({ queryKey: ['notifications', 'unread', userId], queryFn: () => getUnreadNotificationCountFn(), refetchInterval: 30000, refetchOnWindowFocus: true })
    return <Link to="/notifications" aria-label={`站内通知，${count} 条未读`} title="站内通知" className="coeer-focus relative ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
        <Icon name="bell" />{count > 0 ? <span className="absolute right-0 top-0 min-w-4 rounded-full bg-primary px-1 text-center text-xs text-primary-foreground">{count > 99 ? '99+' : count}</span> : null}
    </Link>
}
