import { useState } from 'react'
import type { IconName } from '../lib/types'
import { cn } from '../lib/cn'
import { Icon } from './Icon'
import { IMAGE_SPECS, type ImageSpecName } from '@shared/images'

// Older deployments stored third-party placeholders. Use the bundled artwork
// without requiring the development-only seed command to rewrite production data.
const legacyDemoMedia = new Map([
    ['https://placehold.co/512x512?text=COEER+Common', '/demo/card-common.svg'],
    ['https://placehold.co/512x512?text=COEER+Rare', '/demo/card-rare.svg'],
    ['https://placehold.co/512x512?text=COEER+Legendary', '/demo/card-legendary.svg'],
    ['https://placehold.co/512x512?text=Sticker', '/demo/sticker.svg'],
    ['https://placehold.co/512x512?text=Ticket', '/demo/ticket.svg'],
    ['https://placehold.co/512x512?text=Bag', '/demo/bag.svg'],
])

/** Keep collection layouts stable when optional or external artwork is unavailable. */
export function MediaPreview({ src, alt, icon = 'gift', className, preset }: {
    src?: string | null
    alt: string
    icon?: IconName
    className?: string
    preset?: ImageSpecName
}) {
    const [failedSrc, setFailedSrc] = useState<string>()
    const imageSrc = src ? legacyDemoMedia.get(src) ?? src : undefined
    const spec = preset ? IMAGE_SPECS[preset] : undefined
    return <div style={spec ? { aspectRatio: `${spec.width}/${spec.height}` } : undefined}
        className={cn('relative grid w-full place-items-center overflow-hidden bg-muted text-muted-foreground', !spec && 'aspect-video max-h-44', className)}>
        {imageSrc && failedSrc !== imageSrc ? <img src={imageSrc} alt={alt} loading="lazy" decoding="async"
            onError={() => setFailedSrc(imageSrc)} className={cn('absolute inset-0 h-full w-full', spec ? 'object-contain' : 'object-cover')} /> :
            <Icon name={icon} className="h-8 w-8" />}
    </div>
}
