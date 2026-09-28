import type { TextareaHTMLAttributes } from 'react'

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-24 w-full resize-y rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-focus/50 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`.trim()} />
}
