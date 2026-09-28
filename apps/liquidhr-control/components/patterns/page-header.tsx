import type { ReactNode } from 'react'

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end"><div>{eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-success">{eyebrow}</p> : null}<h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{title}</h1>{description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}</div>{action}</header>
}
