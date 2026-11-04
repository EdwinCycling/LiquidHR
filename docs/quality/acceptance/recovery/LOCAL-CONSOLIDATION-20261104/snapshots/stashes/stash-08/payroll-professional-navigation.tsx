import Link from 'next/link'

export type PayrollProfessionalArea = 'overview' | 'runs' | 'corrections' | 'compare' | 'arrangements' | 'settings'

const NAV_ITEMS: readonly { readonly area: PayrollProfessionalArea; readonly href: string }[] = [
  { area: 'overview', href: '/payroll' },
  { area: 'runs', href: '/payroll/runs' },
  { area: 'corrections', href: '/payroll/corrections' },
  { area: 'compare', href: '/payroll/compare' },
  { area: 'arrangements', href: '/payroll/arrangements' },
  { area: 'settings', href: '/payroll/settings' },
]

export function PayrollProfessionalNavigation({
  active,
  labels,
}: {
  readonly active: PayrollProfessionalArea
  readonly labels: Readonly<Record<PayrollProfessionalArea, string>>
}) {
  return <nav aria-label={labels.overview} className="flex max-w-full gap-2 overflow-x-auto pb-1">
    {NAV_ITEMS.map(({ area, href }) => <Link
      key={area}
      aria-current={area === active ? 'page' : undefined}
      className={`shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-focus ${area === active ? 'border-primary bg-accent text-primary' : 'border-border-subtle text-muted-foreground hover:bg-surface-subtle hover:text-foreground'}`}
      href={href}
    >{labels[area]}</Link>)}
  </nav>
}
