import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

export function AdminSettingsPageHeader({
  backLabel,
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  backLabel: string
  eyebrow: string
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-7 border-b pb-7">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80"
        href="/settings"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {backLabel}
      </Link>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      {subtitle ? (
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
      {actions ? <div className="mt-5">{actions}</div> : null}
    </header>
  )
}
