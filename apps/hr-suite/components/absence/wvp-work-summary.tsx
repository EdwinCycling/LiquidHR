import Link from 'next/link'
import { listWvpCases, WvpError } from '@/lib/absence/wvp/service'
import { getTranslator } from '@/lib/i18n/server'

export async function WvpWorkSummary() {
  let dossiers: Awaited<ReturnType<typeof listWvpCases>>
  try { dossiers = await listWvpCases() }
  catch (error) {
    if (error instanceof WvpError && error.code === 'WVP_SCHEMA_REQUIRED') return null
    throw error
  }
  const items = dossiers.filter(dossier => !dossier.closedAt && (
    (dossier.canManage && !dossier.canConfirm && dossier.processInstanceId)
    || (dossier.isSelf && dossier.events.some(event => event.type === 'AGREEMENT' && !dossier.events.some(ack => ack.type === 'ACKNOWLEDGED' && ack.agreementId === event.id)))
  ))
  if (!items.length) return null
  const t = await getTranslator('employees')
  return <section className="mx-4 mt-4 border-y border-border-subtle py-4 sm:mx-6 lg:mx-8" aria-label={t('wvp.title')}>
    <h2 className="font-semibold">{t('wvp.title')}</h2>
    <ul className="mt-2 space-y-2">{items.map(dossier => <li key={dossier.id}><Link href={`/absence/guidance/${dossier.id}`} className="text-sm text-primary underline">{dossier.name} · {t(dossier.isSelf ? 'wvp.acknowledge' : 'wvp.recordAgreement')}</Link></li>)}</ul>
  </section>
}
