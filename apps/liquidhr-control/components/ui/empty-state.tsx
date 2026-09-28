import type { ReactNode } from 'react'

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return <div className="flex min-h-28 flex-col items-center justify-center rounded-[var(--radius-surface)] border border-dashed border-border bg-surface-subtle px-5 py-6 text-center"><span className="text-muted-foreground [&_svg]:size-5">{icon}</span><p className="mt-3 text-sm font-medium text-foreground">{title}</p>{description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}</div>
}
