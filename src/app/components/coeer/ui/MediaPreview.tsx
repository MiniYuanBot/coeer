import { useState } from 'react'
import type { IconName } from '../lib/types'
import { cn } from '../lib/cn'
import { Icon } from './Icon'

/** Keep collection layouts stable when optional or external artwork is unavailable. */
export function MediaPreview({ src, alt, icon = 'gift', className }: {
    src?: string | null
    alt: string
    icon?: IconName
    className?: string
}) {
    const [failedSrc, setFailedSrc] = useState<string>()
    return <div className={cn('grid aspect-video max-h-44 place-items-center overflow-hidden bg-muted/60 text-muted-foreground', className)}>
        {src && failedSrc !== src ? <img src={src} alt={alt} loading="lazy" decoding="async"
            onError={() => setFailedSrc(src)} className="h-full w-full object-cover" /> :
            <Icon name={icon} className="h-8 w-8" />}
    </div>
}
