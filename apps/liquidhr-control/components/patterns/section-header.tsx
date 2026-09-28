import type { ReactNode } from 'react'

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>{description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}</div>{action}</div>
}
