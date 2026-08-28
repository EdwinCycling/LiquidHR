import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'

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
    <div className="mb-8">
      <Link
        className="inline-flex min-h-8 items-center gap-2 rounded-[var(--radius-control)] text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        href={backHref}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {backLabel}
      </Link>
      <div className="mt-5">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <PageHeader actions={actions} description={subtitle} title={title} />
      </div>
    </div>
  )
}
