import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput({ className, leadingIcon, trailingIcon, ...props }, ref) {
  const input = (
    <input
      {...props}
      className={`min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus/50 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:border-destructive aria-[invalid=true]:focus-visible:outline-destructive disabled:cursor-not-allowed disabled:opacity-60 ${leadingIcon ? 'pl-10' : ''} ${trailingIcon ? 'pr-10' : ''} ${className ?? ''}`.trim()}
      ref={ref}
    />
  )

  if (!leadingIcon && !trailingIcon) return input

  return (
    <span className="relative block w-full">
      {input}
      {leadingIcon ? <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0">{leadingIcon}</span> : null}
      {trailingIcon ? <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0">{trailingIcon}</span> : null}
    </span>
  )
})
