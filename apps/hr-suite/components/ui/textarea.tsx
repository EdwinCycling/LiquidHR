import type { TextareaHTMLAttributes } from 'react'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full resize-y rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus/50 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:border-destructive aria-[invalid=true]:focus-visible:outline-destructive disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`.trim()}
    />
  )
}
