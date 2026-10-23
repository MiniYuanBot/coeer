import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

const fieldClass =
    'coeer-focus w-full min-w-0 rounded-md border border-border bg-background px-3 text-[13px] text-foreground disabled:cursor-not-allowed disabled:opacity-50'

export function Field({
    label,
    description,
    children,
    className,
}: {
    label: string
    description?: string
    children: ReactNode
    className?: string
}) {
    return (
        <label className={cn('grid min-w-0 content-start gap-2 text-xs font-medium', className)}>
            <span>{label}</span>
            {children}
            {description && (
                <span className="text-xs font-normal leading-5 text-muted-foreground">{description}</span>
            )}
        </label>
    )
}
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
    return <input {...props} className={cn(fieldClass, 'h-9', className)} />
}
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
    return <select {...props} className={cn(fieldClass, 'coeer-select h-9', className)} />
}
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea {...props} className={cn(fieldClass, 'min-h-24 resize-y py-2 leading-6', className)} />
}
