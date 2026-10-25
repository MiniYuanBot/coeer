export function Avatar({ name, src, className = 'h-10 w-10' }: { name?: string | null; src?: string | null; className?: string }) {
    return <span className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-medium text-primary ${className}`}>
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : (name || 'U').slice(0, 1).toUpperCase()}
    </span>
}
