import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { Surface } from '@/components/ui/surface'
import { ArrangementCatalogue, type ArrangementCatalogueQuery } from '@/components/payroll/arrangement-catalogue'
import { AuthenticationError, AuthorizationError, getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { getTranslator } from '@/lib/i18n/server'
import { loadArrangementFoundationPage, type ArrangementFoundationPageData } from '@/lib/payroll/arrangement-service'
import type { ArrangementServiceError } from '@/lib/payroll/arrangement-service'

type ArrangementQuery = ArrangementCatalogueQuery & {
  activated?: string | string[]
  ended?: string | string[]
  availability?: string | string[]
  error?: string | string[]
}

const ERROR_TRANSLATION_KEYS: Readonly<Record<string, string>> = {
  'not-available': 'arrangementsErrorNotAvailable',
  'invalid-input': 'arrangementsErrorInvalidInput',
  'version-unavailable': 'arrangementsErrorVersionUnavailable',
  'invalid-date': 'arrangementsErrorInvalidDate',
  'save-failed': 'arrangementsErrorSaveFailed',
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export default async function PayrollArrangementsPage({
  searchParams,
}: {
  searchParams?: Promise<ArrangementQuery>
}) {
  const t = await getTranslator('navigation')
  let data: ArrangementFoundationPageData
  let activeAdministrationName: string | null = null
  try {
    const requestContext = await getRequestAuthorizationContext()
    activeAdministrationName = requestContext.activeContext.activeAdministration?.name ?? null
    data = await loadArrangementFoundationPage()
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    const unavailable = (error as ArrangementServiceError).code === 'ARRANGEMENT_STORAGE_UNAVAILABLE'
      || (error as ArrangementServiceError).code === 'ARRANGEMENT_DATA_INVALID'
    return <PageShell className="space-y-6 py-6 sm:py-8" role="status">
      <PageHeader title={t('payrollArrangements')} description={t('arrangementsUnavailable')} />
      <Surface className="p-5">
        <p>{unavailable ? t('arrangementsStorageUnavailable') : t('arrangementsUnavailable')}</p>
      </Surface>
    </PageShell>
  }

  const query = await searchParams
  const pageData = {
    ...data,
    administrationName: activeAdministrationName || data.administrationName,
  }
  const errorKey = ERROR_TRANSLATION_KEYS[single(query?.error) ?? '']
  const successKey = single(query?.ended) === '1'
    ? 'arrangementsAvailabilityEnded'
    : single(query?.availability) === 'extended'
      ? 'arrangementsAvailabilityStartExtended'
      : single(query?.activated) === '1'
        ? 'arrangementsPackagesActivated'
        : undefined

  const catalogueQuery: ArrangementCatalogueQuery = {
    ...(single(query?.q) ? { q: single(query?.q) } : {}),
    ...(single(query?.kind) ? { kind: single(query?.kind) } : {}),
    ...(single(query?.status) ? { status: single(query?.status) } : {}),
    ...(single(query?.sort) ? { sort: single(query?.sort) } : {}),
    ...(single(query?.package) ? { package: single(query?.package) } : {}),
  }

  return <PageShell className="space-y-5 py-6 sm:py-8">
    <PageHeader title={t('payrollArrangements')} description={t('arrangementsDescription', { administration: pageData.administrationName })} />
    {errorKey ? <Surface className="border border-border p-4" role="alert"><p>{t(errorKey)}</p></Surface> : null}
    {successKey ? <Surface className="border border-border p-4" role="status"><p>{t(successKey)}</p></Surface> : null}
    <Surface className="border border-info-border bg-info-surface p-4">
      <p className="text-sm text-foreground">{t('arrangementsCatalogueNotice')}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{t('arrangementsCalculationNotValidated')}</p>
    </Surface>
    <ArrangementCatalogue data={pageData} query={catalogueQuery} t={t} />
  </PageShell>
}
