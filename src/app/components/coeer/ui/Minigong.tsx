import { useEffect, useRef } from 'react'

/** The existing transparent mascot is a content asset, independent of the CSS canvas. */
export function Minigong({ className = '' }: { className?: string }) {
    const image = useRef<HTMLImageElement>(null)
    useEffect(() => {
        // A failed SSR image can finish before React attaches the error listener.
        if (image.current?.complete && !image.current.naturalWidth) image.current.style.visibility = 'hidden'
    }, [])
    return <img ref={image} src="/minigong.png" alt="" aria-hidden="true" width={1160} height={1355}
        decoding="async" className={`coeer-minigong ${className}`}
        onError={event => { event.currentTarget.style.visibility = 'hidden' }} />
}
