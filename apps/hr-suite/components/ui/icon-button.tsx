import type { ButtonHTMLAttributes, ReactNode } from 'react'

import {
  buttonVariantClasses,
  type ButtonSize,
  type ButtonVariant,
} from './button'

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> & {
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const iconButtonSizeClasses: Record<ButtonSize, string> = {
  md: 'min-h-10 min-w-10',
  sm: 'min-h-8 min-w-8',
}

export function IconButton({
  children,
  className,
  label,
  size = 'md',
  variant = 'primary',
  ...props
}: IconButtonProps) {
  const iconSizeClass = size === 'sm' ? '[&>svg]:size-4' : '[&>svg]:size-5'

  return (
    <button
      {...props}
      aria-label={label}
      className={`ui-icon-button inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] p-0 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 ${iconButtonSizeClasses[size]} ${buttonVariantClasses[variant]} ${iconSizeClass} ${className ?? ''}`.trim()}
    >
      {children}
    </button>
  )
}
