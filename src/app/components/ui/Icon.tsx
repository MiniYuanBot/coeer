import { ICONS, type IconKey } from '../icons'

interface IconProps extends React.SVGAttributes<SVGElement> {
    name: IconKey
    variant?: 'fill' | 'stroke'
    className?: string
}

export function Icon({
    name,
    variant = 'stroke',
    className = '',
    viewBox = '0 0 24 24',
    ...props
}: IconProps) {
    const innerContent = ICONS[name]

    if (!innerContent) return null

    const svgProps = variant === 'fill'
        ? {
            fill: 'currentColor',
            stroke: 'none',
        }
        : {
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round' as const,
            strokeLinejoin: 'round' as const,
        }

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={viewBox}
            className={`shrink-0 ${className}`}
            {...svgProps}
            {...props}
            dangerouslySetInnerHTML={{ __html: innerContent }}
        />
    )
}