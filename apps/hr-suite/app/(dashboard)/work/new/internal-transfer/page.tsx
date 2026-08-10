import Link from 'next/link'
import { InternalTransferStartForm, type InternalTransferStartLabels } from '@/components/process-automation/internal-transfer-start-form'
import { getInternalTransferStartData, type InternalTransferStartData } from '@/lib/process-automation/internal-transfer-start-service'
import { ProcessRecipeError } from '@/lib/process-automation/recipe-service'
import { getTranslator } from '@/lib/i18n/server'

interface InternalTransferStartPageProps {
  readonly searchParams: Promise<{ employeeId?: string; departmentId?: string }>
}

function safeUuid(value: string | undefined): string | undefined {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : undefined
}

export default async function InternalTransferStartPage({ searchParams }: InternalTransferStartPageProps) {
  const query = await searchParams
  const initialEmployeeId = safeUuid(query.employeeId)
  const departmentId = safeUuid(query.departmentId)
  const t = await getTranslator('processAutomation')
  let data: InternalTransferStartData | null = null
  try {
    data = await getInternalTransferStartData(departmentId)
  } catch (error) {
    if (error instanceof ProcessRecipeError && error.code === 'PROCESS_RECIPE_NOT_ACTIVATED') {
      return <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-10">
        <section className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <p className="eyebrow text-primary">P9</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('p9.startTitle')}</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{t('p9.notActivated')}</p>
          <Link className="button-primary mt-6 inline-flex" href="/settings/process-automation?tab=forms">{t('p9.activate')}</Link>
        </section>
      </main>
    }
    throw error
  }
  if (!data) throw new Error('INTERNAL_TRANSFER_START_DATA_MISSING')
  const labels: InternalTransferStartLabels = {
    title: t('p9.startTitle'),
    description: t('p9.startDescription'),
    employee: t('p9.employee'),
    employment: t('p9.employment'),
    effectiveOn: t('p9.effectiveOn'),
    effectiveOnHelp: t('p9.effectiveOnHelp'),
    start: t('p9.start'),
    back: t('p9.back'),
    choose: t('p9.choose'),
    search: t('referenceSearch'),
    required: t('p9.required'),
    starting: t('p9.starting'),
    failed: t('p9.failed'),
    notActivated: t('p9.notActivated'),
  }
  return <InternalTransferStartForm data={data} initialEmployeeId={initialEmployeeId} labels={labels} />
}
