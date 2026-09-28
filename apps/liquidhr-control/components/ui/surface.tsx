import type { HTMLAttributes, ReactNode } from 'react'

export type SurfaceVariant = 'default' | 'subtle' | 'overlay'

const variants: Record<SurfaceVariant, string> = {
  default: 'border border-border bg-surface rounded-[var(--radius-surface)]',
  subtle: 'border border-border bg-surface-subtle rounded-[var(--radius-surface)]',
  overlay: 'border border-border bg-surface-overlay rounded-[var(--radius-overlay)] shadow-sm',
}

export function Surface({ children, className, variant = 'default', ...props }: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children: ReactNode; variant?: SurfaceVariant }) {
  return <div {...props} className={`${variants[variant]} ${className ?? ''}`.trim()}>{children}</div>
}
