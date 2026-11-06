import Link from 'next/link'
import { listWvpCases, WvpError } from '@/lib/absence/wvp/service'
import { nextWvpTask, wvpUrgency } from '@/lib/absence/wvp/domain'
import { wvpLabelKeys, milestoneLabel } from '@/components/absence/wvp-labels'
import { getLocale, getTranslator } from '@/lib/i18n/server'

export async function WvpWorkSummary() {
  let dossiers: Awaited<ReturnType<typeof listWvpCases>>
  try { dossiers = await listWvpCases() }
  catch (error) {
    if (error instanceof WvpError && error.code === 'WVP_SCHEMA_REQUIRED') return null
    throw error
  }
  const items = dossiers.filter(dossier => !dossier.closedAt && (
    (dossier.canManage && dossier.processInstanceId)
    || (dossier.isSelf && dossier.events.some(event => event.type === 'AGREEMENT' && !dossier.events.some(ack => ack.type === 'ACKNOWLEDGED' && ack.agreementId === event.id)))
  ))
  if (!items.length) return null
  const [t, locale] = await Promise.all([getTranslator('employees'), getLocale()])
  const labels = Object.fromEntries(wvpLabelKeys.map(key => [key, t(`wvp.${key}`)]))
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
  return <section className="mx-4 mt-4 border-y border-border-subtle py-4 sm:mx-6 lg:mx-8" aria-label={t('wvp.title')}>
    <h2 className="font-semibold">{t('wvp.title')}</h2>
    <ul className="mt-2 space-y-3">{items.map(dossier => {
      const task = dossier.canManage ? nextWvpTask(dossier.tasks, dossier.currentMilestone) : null
      return <li key={dossier.id} className="flex flex-col gap-1 text-sm">
        <Link href={`/absence/guidance/${dossier.id}`} className="w-fit text-primary underline">{dossier.name} · {t(dossier.isSelf ? 'wvp.acknowledge' : 'wvp.nextAction')}</Link>
        {task ? <span className="text-muted-foreground">{milestoneLabel(task.code, labels)} · {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${task.dueOn}T00:00:00Z`))} · {labels[wvpUrgency(task.dueOn, today)]}</span> : null}
      </li>
    })}</ul>
  </section>
}
