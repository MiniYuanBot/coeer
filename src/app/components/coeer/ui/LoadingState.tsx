export function LoadingState({ label = '正在加载…' }: { label?: string }) {
    return (
        <div
            role="status"
            className="flex min-h-40 items-center justify-center gap-2 text-[13px] text-muted-foreground"
        >
            <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-primary"
            />
            {label}
        </div>
    )
}
