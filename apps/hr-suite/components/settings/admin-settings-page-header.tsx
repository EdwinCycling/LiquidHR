import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
export function AdminSettingsPageHeader({
  backLabel,
  eyebrow,
  title,
  subtitle,
  actions,
  backHref = '/settings',
}: {
  backLabel: string
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  backHref?: string
}) {
  return (
    <header className="mb-8">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80"
        href={backHref}
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {backLabel}
      </Link>
      {eyebrow ? <p className="eyebrow mt-5">{eyebrow}</p> : null}
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{title}</h1>
      {subtitle ? (
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
      {actions ? <div className="mt-5">{actions}</div> : null}
    </header>
  )
}
