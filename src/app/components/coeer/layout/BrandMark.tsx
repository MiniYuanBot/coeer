export function BrandMark({ className = 'h-7 w-7' }: { className?: string }) {
    return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="currentColor" />
            <path d="M22 10.4a8 8 0 1 0 0 11.2M18.5 12.7a4.7 4.7 0 1 0 0 6.6" stroke="hsl(var(--primary-foreground))" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
    )
}
