import type { ReactNode } from 'react'
import { Surface } from '@/components/ui/surface'

export type DataTableShellProps = {
  children: ReactNode
  stateContent?: ReactNode
  state?: 'ready' | 'loading' | 'empty' | 'error'
  caption?: ReactNode
  stickyHeader?: boolean
  className?: string
}

export function DataTableShell({ caption, children, className, state = 'ready', stateContent, stickyHeader = false }: DataTableShellProps) {
  return (
    <Surface className={`overflow-hidden ${className ?? ''}`.trim()}>
      {state === 'ready' ? (
        <div className="overflow-x-auto">
          <table className={`w-full min-w-full border-collapse text-left text-sm ${stickyHeader ? '[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-surface' : ''}`.trim()}>
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            {children}
          </table>
        </div>
      ) : <div aria-busy={state === 'loading' || undefined} className="p-5" role={state === 'loading' ? 'status' : undefined}>{stateContent}</div>}
    </Surface>
  )
}
