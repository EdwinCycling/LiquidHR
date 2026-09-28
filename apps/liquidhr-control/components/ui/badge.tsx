import type { HTMLAttributes, ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-subtle text-muted-foreground',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-destructive-subtle text-destructive',
}

export function Badge({ children, className, tone = 'neutral', ...props }: Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & { children: ReactNode; tone?: BadgeTone }) {
  return <span {...props} className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className ?? ''}`.trim()}>{children}</span>
}
