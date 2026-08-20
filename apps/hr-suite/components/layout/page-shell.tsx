import type { HTMLAttributes, ReactNode } from 'react'

export type PageShellWidth = 'reading' | 'standard' | 'wide'

export type PageShellProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  width?: PageShellWidth
  children: ReactNode
}

const pageShellWidthClasses: Record<PageShellWidth, string> = {
  reading: 'max-w-3xl',
  standard: 'max-w-7xl',
  wide: 'max-w-screen-2xl',
}

export function PageShell({ children, className, width = 'standard', ...props }: PageShellProps) {
  return (
    <div {...props} className={`mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 ${pageShellWidthClasses[width]} ${className ?? ''}`.trim()}>
      {children}
    </div>
  )
}
