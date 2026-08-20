import type { HTMLAttributes, ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export type BadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  tone?: BadgeTone
  children: ReactNode
}

const badgeToneClasses: Record<BadgeTone, string> = {
  neutral: 'border-border-subtle bg-muted text-foreground',
  info: 'border-info-border bg-info-surface text-info',
  success: 'border-success bg-success-surface text-success',
  warning: 'border-warning bg-warning-surface text-warning',
  danger: 'border-destructive bg-destructive-surface text-destructive',
}

export function Badge({ children, className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span {...props} className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium leading-5 ${badgeToneClasses[tone]} ${className ?? ''}`.trim()}>
      {children}
    </span>
  )
}
