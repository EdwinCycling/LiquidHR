import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { FormField } from '@/components/patterns/form-field'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Button } from '@/components/ui/button'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { listWvpCases, WvpError } from '@/lib/absence/wvp/service'
import { nextWvpTask, wvpUrgency } from '@/lib/absence/wvp/domain'
import { milestoneLabel, wvpLabelKeys } from '@/components/absence/wvp-labels'

export default async function AbsenceGuidancePage({ searchParams }: { searchParams: Promise<{ urgency?: string; status?: string }> }) {
  const [t, locale, filters] = await Promise.all([getTranslator('employees'), getLocale(), searchParams])
  let cases: Awaited<ReturnType<typeof listWvpCases>> = []
  let unavailable = false
  try {
    await requirePermission('absence:read')
    cases = await listWvpCases()
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) redirect('/geen-toegang')
    if (error instanceof WvpError && error.code === 'WVP_SCHEMA_REQUIRED') unavailable = true
    else throw error
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
  const labels = Object.fromEntries(wvpLabelKeys.map(key => [key, t(`wvp.${key}`)]))
  const rows = cases.map(dossier => {
    const task = nextWvpTask(dossier.tasks, dossier.currentMilestone)
    const status = dossier.closedAt ? 'CLOSED' : dossier.status
    return { dossier, task, status, urgency: task ? wvpUrgency(task.dueOn, today) : 'UNKNOWN' }
  })
  const active = rows.filter(row => row.status !== 'CLOSED')
  const overdue = active.flatMap(row => row.dossier.tasks.filter(task => task.status === 'OPEN' && wvpUrgency(task.dueOn, today) === 'OVERDUE')).length
  const soon = active.flatMap(row => row.dossier.tasks.filter(task => task.status === 'OPEN' && wvpUrgency(task.dueOn, today) === 'SOON')).length
  const urgency = ['OVERDUE', 'SOON', 'PLANNED', 'UNKNOWN'].includes(filters.urgency ?? '') ? filters.urgency : ''
  const status = ['ACTIVE', 'RECOVERY_WINDOW', 'CLOSED'].includes(filters.status ?? '') ? filters.status : ''
  const visible = rows.filter(row => (!urgency || row.urgency === urgency) && (!status || row.status === status))
    .sort((a, b) => (a.task?.dueOn ?? '9999-12-31').localeCompare(b.task?.dueOn ?? '9999-12-31') || a.dossier.id.localeCompare(b.dossier.id))
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
  return <PageShell className="py-7">
    <PageHeader title={t('wvp.title')} description={t('wvp.description')} />
    <Link href="/work" className="my-4 inline-block text-sm text-primary underline">{t('wvp.work')}</Link>
    {unavailable ? <p role="status">{t('wvp.schemaRequired')}</p> : <>
      <p className="mb-4 text-sm text-muted-foreground">{t('wvp.privacy')}</p>
      {cases.length === 250 && <p role="status" className="mb-4 text-sm">{t('wvp.truncated')}</p>}
      <section aria-label={t('wvp.controlTitle')} className="border-y border-border-subtle py-4">
        <h2 className="font-semibold">{t('wvp.controlTitle')}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div><dt>{t('wvp.controlActive')}</dt><dd className="font-semibold">{active.length}</dd></div>
          <div><dt>{t('wvp.controlOverdue')}</dt><dd className="font-semibold">{overdue}</dd></div>
          <div><dt>{t('wvp.controlSoon')}</dt><dd className="font-semibold">{soon}</dd></div>
        </dl>
        <p className="mt-2 text-sm text-muted-foreground">{t('wvp.controlScopeNote')}</p>
      </section>
      <form className="my-4 flex flex-wrap items-end gap-3" method="get">
        <FormField label={t('wvp.controlUrgency')} control={<DropdownSelect name="urgency" defaultValue={urgency} searchable><option value="">{t('wvp.controlAll')}</option>{['OVERDUE','SOON','PLANNED','UNKNOWN'].map(value => <option key={value} value={value}>{value === 'UNKNOWN' ? t('wvp.controlUnknown') : t(`wvp.${value}`)}</option>)}</DropdownSelect>} />
        <FormField label={t('wvp.controlStatus')} control={<DropdownSelect name="status" defaultValue={status} searchable><option value="">{t('wvp.controlAll')}</option>{['ACTIVE','RECOVERY_WINDOW','CLOSED'].map(value => <option key={value} value={value}>{t(`wvp.${value}`)}</option>)}</DropdownSelect>} />
        <Button type="submit">{t('wvp.controlFilter')}</Button>
      </form>
      <h2 className="font-semibold">{t('wvp.controlPriorities')}</h2>
      <ul className="divide-y divide-border-subtle border-y border-border-subtle">{visible.map(({ dossier, task, status: rowStatus, urgency: rowUrgency }) => <li key={dossier.id}><Link className="flex flex-col gap-1 py-4 focus-visible:outline-2 focus-visible:outline-focus sm:flex-row sm:justify-between" href={`/absence/guidance/${dossier.id}`}><span className="min-w-0 break-words font-semibold">{dossier.name} · {t(`wvp.${rowStatus}`)}</span><span className="text-sm">{task ? `${milestoneLabel(task.code, labels)} · ${date(task.dueOn)} · ${t(`wvp.${rowUrgency}`)}` : t('wvp.controlUnknown')}</span></Link></li>)}</ul>
      {!visible.length && <p className="mt-4">{cases.length ? t('wvp.controlNoResults') : t('wvp.empty')}</p>}
    </>}
  </PageShell>
}
