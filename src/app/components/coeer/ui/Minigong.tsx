import { useEffect, useRef } from 'react'
import mascot from '@/assets/minigong-480.webp'
import mascotLarge from '@/assets/minigong-960.webp'

/** The existing transparent mascot is a content asset, independent of the CSS canvas. */
export function Minigong({ className = '' }: { className?: string }) {
    const image = useRef<HTMLImageElement>(null)
    useEffect(() => {
        // A failed SSR image can finish before React attaches the error listener.
        if (image.current?.complete && !image.current.naturalWidth) image.current.style.visibility = 'hidden'
    }, [])
    return <img ref={image} src={mascot} srcSet={`${mascot} 480w, ${mascotLarge} 960w`}
        sizes="(max-width: 639px) 88px, 220px" alt="" aria-hidden="true" width={1160} height={1355}
        fetchPriority="high"
        decoding="async" className={`coeer-minigong ${className}`}
        onError={event => { event.currentTarget.style.visibility = 'hidden' }} />
}
