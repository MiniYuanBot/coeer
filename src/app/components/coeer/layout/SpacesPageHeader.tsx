import type { ComponentProps } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { useSpaces } from '@/hooks/useSpaces'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { NavTabs, navTabClass, activeNavTabClass } from '../ui/NavTabs'
import { SectionHeader } from '../ui/SectionHeader'

/** Keep the page title above the same two navigation choices in every space view. */
export function SpacesPageHeader(props: ComponentProps<typeof SectionHeader>) {
    const pathname = useLocation({ select: location => location.pathname })
    const bookings = pathname.startsWith('/spaces/bookings')
    const { config, error, reload } = useSpaces()
    return <>
        <SectionHeader {...props} />
        <NavTabs label="空间预约">
            <Link to="/spaces" search={{}} activeOptions={{ exact: true, includeSearch: false }}
                className={`${navTabClass} ${!bookings ? activeNavTabClass : ''}`}>空间目录</Link>
            <Link to="/spaces/bookings" activeOptions={{ includeSearch: false }}
                className={`${navTabClass} ${bookings ? activeNavTabClass : ''}`}>我的预约</Link>
        </NavTabs>
        {config?.demo && <Alert>演示环境：空间与预约使用模拟数据，不会提交至官方系统。</Alert>}
        {config && !config.writesEnabled && <Alert>当前仅开放空间状态查询，预约提交尚未启用。</Alert>}
        {config?.paused && config.writesEnabled && <Alert tone="warning">自动处理已暂停，提交的申请将在恢复后继续处理。</Alert>}
        {error && <Alert tone="danger">{error}<Button variant="ghost" size="sm" onClick={reload}>重试</Button></Alert>}
    </>
}
