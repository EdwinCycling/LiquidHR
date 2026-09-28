import type { HTMLAttributes, ReactNode } from 'react'

export function PageShell({ children, className, width = 'standard', ...props }: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children: ReactNode; width?: 'reading' | 'standard' | 'wide' }) {
  const widthClass = width === 'reading' ? 'max-w-3xl' : width === 'wide' ? 'max-w-screen-2xl' : 'max-w-7xl'
  return <div {...props} className={`mx-auto w-full min-w-0 px-4 py-8 sm:px-6 lg:px-8 lg:py-10 ${widthClass} ${className ?? ''}`.trim()}>{children}</div>
}
