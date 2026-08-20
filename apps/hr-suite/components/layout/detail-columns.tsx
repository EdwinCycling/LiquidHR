import type { HTMLAttributes, ReactNode } from 'react'

export type DetailColumnsProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  main: ReactNode
  aside: ReactNode
}

export function DetailColumns({ aside, className, main, ...props }: DetailColumnsProps) {
  return (
    <div {...props} className={`grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3 ${className ?? ''}`.trim()}>
      <div className="min-w-0 lg:col-span-2">{main}</div>
      <div className="min-w-0">{aside}</div>
    </div>
  )
}
