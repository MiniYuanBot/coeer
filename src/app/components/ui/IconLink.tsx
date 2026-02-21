import { Link, useLocation } from '@tanstack/react-router'
import { Icon } from './Icon'
import type { IconKey } from '../icons'

interface IconLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string
    label: string
    icon: IconKey
    isExternal?: boolean
    isMobile?: boolean
    delay?: string | number
    className?: string
}

export function IconLink({
    href,
    label,
    icon,
    isExternal = false,
    isMobile = false,
    delay,
    className = '',
    children,
    ...props
}: IconLinkProps) {
    const location = useLocation()
    const pathname = location.pathname

    const isExternalLink = isExternal || href.startsWith('http')

    const isActive = !isExternalLink && (
        href === pathname ||
        href === '/' + (pathname.match(/[^/]+/g)?.[0] || '')
    )

    const externalProps = isExternalLink
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {}

    const style: React.CSSProperties = {}
    if (delay !== undefined) {
        style.animationDelay = typeof delay === 'number' ? `${delay}ms` : delay
    }

    const baseClasses = !isMobile
        ? 'icon-button-base'
        : 'mobile-menu-item-base'

    const activeClasses = isActive
        ? [
            'text-accent font-semibold',
            isMobile && 'mobile-active-indicator'
        ].filter(Boolean).join(' ')
        : ''

    const iconClasses = `icon-base ${isActive ? 'text-accent' : ''}`

    if (isExternalLink) {
        return (
            <a
                href={href}
                aria-label={label}
                className={`${baseClasses} ${activeClasses} ${className}`}
                style={style}
                aria-current={isActive ? 'page' : undefined}
                {...externalProps}
                {...props}
            >
                <Icon name={icon} className={iconClasses} />
                {!isMobile && <span className="sr-only">{label}</span>}
                {isMobile && <span className="inherent">{label}</span>}
                {children}
            </a>
        )
    }

    return (
        <Link
            to={href}
            aria-label={label}
            className={`${baseClasses} ${activeClasses} ${className}`}
            style={style}
            aria-current={isActive ? 'page' : undefined}
            {...props}
        >
            <Icon name={icon} className={iconClasses} />
            {!isMobile && <span className="sr-only">{label}</span>}
            {isMobile && <span className="inherent">{label}</span>}
            {children}
        </Link>
    )
}