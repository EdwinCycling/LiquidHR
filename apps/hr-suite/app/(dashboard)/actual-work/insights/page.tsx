import { redirect } from 'next/navigation'
import { ActualWorkInsightsView } from '@/components/actual-work/actual-work-insights-view'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getActualWorkInsights } from '@/lib/actual-work/actual-work-service'
import { getTranslator } from '@/lib/i18n/server'

type Props = { searchParams: Promise<{ month?: string }> }

function monthOrCurrent(value: string | undefined): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : new Date().toISOString().slice(0, 7)
}

export default async function ActualWorkInsightsPage({ searchParams }: Props) {
  const month = monthOrCurrent((await searchParams).month)
  let report: Awaited<ReturnType<typeof getActualWorkInsights>>
  try {
    report = await getActualWorkInsights(month)
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const t = await getTranslator('insights')
  return <ActualWorkInsightsView labels={{
    title: t('actualWorkTitle'),
    description: t('actualWorkDescription'),
    month: t('actualWorkMonth'),
    entries: t('actualWorkEntries'),
    hours: t('actualWorkHours'),
    corrections: t('actualWorkCorrections'),
    family: t('actualWorkFamily'),
    employee: t('actualWorkEmployee'),
    type: t('actualWorkType'),
    date: t('actualWorkDate'),
    empty: t('actualWorkEmpty'),
    back: t('actualWorkBack'),
    familyWork: t('actualWorkFamilyWork'),
    familyAdditional: t('actualWorkFamilyAdditional'),
    familyOvertime: t('actualWorkFamilyOvertime'),
    familyTransparent: t('actualWorkFamilyTransparent'),
  }} report={report} />
}
