import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'border border-border-strong bg-accent text-accent-foreground hover:bg-accent-hover',
  danger: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover',
  ghost: 'bg-transparent text-foreground hover:bg-surface-subtle',
}

export const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-3 text-sm',
  md: 'min-h-10 px-4 text-sm',
}

export function buttonClasses({
  className,
  size = 'md',
  variant = 'primary',
}: { className?: string; size?: ButtonSize; variant?: ButtonVariant } = {}): string {
  return `relative inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-medium leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0 ${buttonSizeClasses[size]} ${buttonVariantClasses[variant]} ${className ?? ''}`.trim()
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
      className={buttonClasses({ className, size, variant })}
      disabled={isDisabled}
    >
      <span className={`inline-flex min-w-0 items-center gap-2 ${loading ? 'invisible' : ''}`.trim()}>{children}</span>
      {loading ? <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center"><span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /></span> : null}
    </button>
  )
}
