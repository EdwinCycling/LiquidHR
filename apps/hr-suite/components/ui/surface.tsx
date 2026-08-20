import type { HTMLAttributes, ReactNode } from 'react'

export type SurfaceVariant = 'default' | 'subtle' | 'overlay'

export type SurfaceProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  variant?: SurfaceVariant
  children: ReactNode
}

const surfaceVariantClasses: Record<SurfaceVariant, string> = {
  default: 'border border-subtle bg-surface rounded-[var(--radius-surface)]',
  subtle: 'border border-subtle bg-surface-subtle rounded-[var(--radius-surface)]',
  overlay: 'border border-subtle bg-surface-overlay rounded-[var(--radius-overlay)] shadow-sm',
}

export function Surface({ children, className, variant = 'default', ...props }: SurfaceProps) {
  return (
    <div {...props} className={`${surfaceVariantClasses[variant]} ${className ?? ''}`.trim()}>
      {children}
    </div>
  )
}
