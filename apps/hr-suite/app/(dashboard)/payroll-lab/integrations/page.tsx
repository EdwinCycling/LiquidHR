import { notFound, redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { PayrollSettingsActions } from '@/components/payroll/payroll-settings-actions'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ModuleError } from '@/lib/modules/module-service'
import { getTranslator } from '@/lib/i18n/server'
import { getPayrollWorkspaceData, PayrollServiceError, type PayrollWorkspaceData } from '@/lib/payroll/payroll-service'
import type { Translator } from '@/lib/i18n/translator'

async function loadPayrollSettings(): Promise<[PayrollWorkspaceData, Translator]> {
  try {
    return await Promise.all([getPayrollWorkspaceData(), getTranslator('payroll')])
  } catch (error) {
    if (error instanceof AuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    if (error instanceof ModuleError && error.status === 404) notFound()
    if (error instanceof PayrollServiceError && error.status === 404) notFound()
    throw error
  }
}

export default async function PayrollSettingsPage({ searchParams }: { searchParams?: Promise<{ payroll?: string | string[] }> }) {
  const [data, t] = await loadPayrollSettings()
  const query = await searchParams
  const callbackStatus = typeof query?.payroll === 'string' ? query.payroll : null
  const connection = data.activeConnection
  const reconnectConnection = connection?.status === 'CONNECTED'
    ? null
    : connection ?? [...data.connections].reverse().find((item) => item.status === 'DISCONNECTED') ?? null
  const provider = connection ? data.providers.find((item) => item.id === connection.providerId) : null

  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('title')} description={t('description')} />
    {callbackStatus === 'connected' || callbackStatus === 'error' ? <p aria-live="polite" className={`rounded-[var(--radius-surface)] border p-4 text-sm ${callbackStatus === 'error' ? 'border-destructive/40 text-destructive' : 'border-success/40 text-success'}`} role="status">{t(`callback.${callbackStatus}`)}</p> : null}
    <Surface className="p-5 sm:p-6">
      <h2 className="text-base font-semibold">{t('connection')}</h2>
      {connection ? <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">{t('provider')}</dt><dd className="mt-1 font-medium">{provider?.name ?? connection.providerId}</dd></div>
        <div><dt className="text-muted-foreground">{t('connection')}</dt><dd className="mt-1 font-medium">{t(`status.${connection.status}`)}</dd></div>
        {connection.lastCheckedAt ? <div><dt className="text-muted-foreground">{t('lastChecked')}</dt><dd className="mt-1 font-medium">{connection.lastCheckedAt}</dd></div> : null}
      </dl> : <p className="mt-3 text-sm text-muted-foreground">{t('noConnection')}</p>}
      <PayrollSettingsActions
        bindings={data.bindings}
        companies={data.providerCompanies}
        connection={connection}
        reconnectConnection={reconnectConnection}
        administrations={data.administrations}
        labels={{
          connect: t('actions.connect'),
          reconnect: t('actions.reconnect'),
          check: t('actions.check'),
          discover: t('actions.discover'),
          bind: t('actions.bind'),
          unbind: t('actions.unbind'),
          disconnect: t('actions.disconnect'),
          confirmDisconnect: t('actions.confirmDisconnect'),
          selectCompany: t('actions.selectCompany'),
          selectAdministration: t('actions.selectAdministration'),
          search: t('actions.search'),
          noCompanies: t('actions.noCompanies'),
          noAdministrations: t('actions.noAdministrations'),
          noBinding: t('actions.noBinding'),
          succeeded: t('actions.succeeded'),
          failed: t('actions.failed'),
          discoveredCompanies: t('actions.discoveredCompanies'),
          bindingHint: t('actions.bindingHint'),
          remoteRevocationWarning: t('actions.remoteRevocationWarning'),
        }}
      />
    </Surface>
    <Surface className="p-5 sm:p-6">
      <h2 className="text-base font-semibold">{t('bindings')}</h2>
      {data.bindings.length ? <ul className="mt-4 space-y-3">{data.bindings.map((binding) => {
        const administration = data.administrations.find((item) => item.id === binding.administrationId)
        return <li className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-3 first:border-0 first:pt-0" key={binding.id}>
          <span className="text-sm"><span className="block font-medium">{binding.externalCompanyDisplayName}</span><span className="text-muted-foreground">{administration?.name ?? binding.administrationId}</span></span>
          <span className="text-sm text-muted-foreground">{t(`status.${binding.status}`)}</span>
        </li>
      })}</ul> : <p className="mt-3 text-sm text-muted-foreground">{t('emptyBindings')}</p>}
    </Surface>
  </PageShell>
}
