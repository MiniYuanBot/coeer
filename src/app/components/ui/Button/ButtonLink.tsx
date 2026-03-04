import { Link } from '@tanstack/react-router'
import { baseClasses, variantClasses, sizeClasses, ButtonVariant, ButtonSize } from './ButtonStyles'

interface ButtonLinkProps{
    to:string;
    variant?:ButtonVariant
    size?:ButtonSize
    className?:string
    children: React.ReactNode
    exact?:boolean
    activeClassName?: string
}

export function ButtonLink({
    to,
    variant='primary',
    size='md',
    className='',
    children,
    exact,
    activeClassName,
    ...props
}:ButtonLinkProps){
    const combinedClassName = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`
    const activeProps = activeClassName ? { className: activeClassName } : undefined
    return(
        <Link to={to}
            className={combinedClassName}
            activeOptions={exact ? { exact: true } : undefined}
            activeProps={activeProps}
            {...props}>
            {children}
        </Link>
    )
}
