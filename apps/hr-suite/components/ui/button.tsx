import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'border border-border bg-surface text-foreground hover:bg-surface-raised',
  danger: 'bg-destructive text-primary-foreground hover:bg-destructive/90',
  ghost: 'bg-transparent text-foreground hover:bg-surface-raised',
}

export const buttonSizeClasses: Record<ButtonSize, string> = {
  md: 'min-h-10 px-4 text-sm',
  sm: 'min-h-8 px-3 text-sm',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children?: ReactNode
}

export function Button({
  children,
  className,
  disabled,
  loading = false,
  size = 'md',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={`relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 ${buttonSizeClasses[size]} ${buttonVariantClasses[variant]} ${className ?? ''}`.trim()}
      disabled={isDisabled}
    >
      <span className={loading ? 'invisible' : undefined}>{children}</span>
      {loading ? (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
        </span>
      ) : null}
    </button>
  )
}
