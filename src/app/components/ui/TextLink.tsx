import { Link, useLocation } from '@tanstack/react-router'

interface TextLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string
    isMobile?: boolean
    delay?: string | number
    className?: string
    children?: React.ReactNode
}

export function TextLink({
    href,
    isMobile = false,
    delay,
    className = '',
    children,
    ...props
}: TextLinkProps) {
    const location = useLocation()
    const pathname = location.pathname

    const isExternal = href.startsWith('http')

    const subpath = pathname.match(/[^/]+/g)
    const isActive = !isExternal && (
        href === pathname ||
        href === '/' + (subpath?.[0] || '')
    )

    const style: React.CSSProperties = {}
    if (delay !== undefined) {
        style.animationDelay = typeof delay === 'number' ? `${delay}ms` : delay
    }

    const linkClasses = [
        className,
        !isMobile && [
            'desktop-nav-item',
            'desktop-nav-text',
            isActive && 'font-semibold text-accent desktop-active-indicator'
        ].filter(Boolean).join(' '),
        isMobile && [
            'mobile-menu-item-base',
            'mobile-menu-text',
            isActive && 'font-semibold text-accent mobile-active-indicator'
        ].filter(Boolean).join(' ')
    ].filter(Boolean).join(' ')

    if (isExternal) {
        return (
            <a
                href={href}
                className={linkClasses}
                style={style}
                aria-current={isActive ? 'page' : undefined}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
            >
                {children}
            </a>
        )
    }

    return (
        <Link
            to={href}
            className={linkClasses}
            style={style}
            aria-current={isActive ? 'page' : undefined}
            {...props}
        >
            {children}
        </Link>
    )
}