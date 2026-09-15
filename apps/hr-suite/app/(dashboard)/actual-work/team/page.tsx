import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getActualWorkTeamProjection } from '@/lib/actual-work/actual-work-service'
import { getTranslator } from '@/lib/i18n/server'

type Props = { searchParams: Promise<{ month?: string }> }

function monthOrCurrent(value: string | undefined): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : new Date().toISOString().slice(0, 7)
}

function familyLabel(family: string, t: (key: string) => string): string {
  if (family === 'ADDITIONAL') return t('actualWorkFamilyAdditional')
  if (family === 'OVERTIME') return t('actualWorkFamilyOvertime')
  if (family === 'TRANSPARENT') return t('actualWorkFamilyTransparent')
  return t('actualWorkFamilyWork')
}

export default async function ActualWorkTeamPage({ searchParams }: Props) {
  const month = monthOrCurrent((await searchParams).month)
  let rows: Awaited<ReturnType<typeof getActualWorkTeamProjection>>
  try {
    rows = await getActualWorkTeamProjection(month)
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const t = await getTranslator('employees')
  return <PageShell className="space-y-6 py-6 sm:py-8" width="wide">
    <PageHeader actions={<Link className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-raised" href="/employees">{t('actualWorkBack')}</Link>} description={t('actualWorkDescription')} title={t('actualWorkTitle') + ' · ' + month} />
    <Surface className="p-5">
      {rows.length === 0 ? <p className="rounded-[var(--radius-control)] border border-dashed p-8 text-center text-sm text-muted-foreground">{t('actualWorkNoEntries')}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-[.08em] text-muted-foreground"><tr><th className="px-3 py-3">{t('actualWorkDate')}</th><th className="px-3 py-3">{t('actualWorkType')}</th><th className="px-3 py-3">{t('actualWorkFamily')}</th><th className="px-3 py-3">{t('actualWorkHours')}</th><th className="px-3 py-3">{t('actualWorkEntries')}</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id}><td className="px-3 py-3">{row.work_date}</td><td className="px-3 py-3"><Link className="font-medium text-primary hover:underline" href={'/employees/' + row.employee.id + '/hours?employmentId=' + row.employment_id + '&month=' + month}>{row.type.name}</Link></td><td className="px-3 py-3">{familyLabel(row.type.family, t)}</td><td className="px-3 py-3 tabular-nums">{String(row.hours)}</td><td className="px-3 py-3">{[row.employee.first_name, row.employee.birth_name_prefix, row.employee.birth_name].filter(Boolean).join(' ')}</td></tr>)}</tbody></table></div>}
    </Surface>
  </PageShell>
}
