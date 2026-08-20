import type { HTMLAttributes, ReactNode } from 'react'

export type InfoListItem = {
  label: ReactNode
  value: ReactNode
}

export type InfoListProps = HTMLAttributes<HTMLDListElement> & {
  items: InfoListItem[]
  columns?: 1 | 2
}

export function InfoList({ className, columns = 1, items, ...props }: InfoListProps) {
  const columnClass = columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'

  return (
    <dl {...props} className={`grid gap-x-6 gap-y-4 ${columnClass} ${className ?? ''}`.trim()}>
      {items.map((item, index) => (
        <div key={index} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 min-w-0 break-words text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
