import { redirect } from 'next/navigation'
import { ActualWorkPayrollWorkspace } from '@/components/actual-work/actual-work-payroll-workspace'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getActualWorkPayrollReview } from '@/lib/actual-work/payroll-work-hours-service'
import { getTranslator } from '@/lib/i18n/server'

type Props = { searchParams: Promise<{ periodStart?: string }> }

function periodOrCurrent(value: string | undefined): string {
  if (value && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value)) return value
  return `${new Date().toISOString().slice(0, 7)}-01`
}

export default async function ActualWorkPayrollPage({ searchParams }: Props) {
  const periodStart = periodOrCurrent((await searchParams).periodStart)
  let initial: Awaited<ReturnType<typeof getActualWorkPayrollReview>>
  try {
    initial = await getActualWorkPayrollReview(periodStart)
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const t = await getTranslator('employees')
  return <ActualWorkPayrollWorkspace initial={initial} labels={{
    title: t('actualWorkPayrollTitle'), description: t('actualWorkPayrollDescription'), period: t('actualWorkPayrollPeriod'),
    load: t('actualWorkPayrollLoad'), bulkInput: t('actualWorkPayrollBulkInput'), importTitle: t('actualWorkPayrollImportTitle'),
    importHelp: t('actualWorkPayrollImportHelp'), chooseFile: t('actualWorkPayrollChooseFile'), preview: t('actualWorkPayrollPreview'),
    confirmImport: t('actualWorkPayrollConfirmImport'), rows: t('actualWorkPayrollRows'), valid: t('actualWorkPayrollValid'),
    invalid: t('actualWorkPayrollInvalid'), duplicate: t('actualWorkPayrollDuplicate'), filter: t('actualWorkPayrollFilter'),
    exceptionsOnly: t('actualWorkPayrollExceptionsOnly'), noEntries: t('actualWorkPayrollNoEntries'), select: t('actualWorkPayrollSelect'),
    saved: t('actualWorkPayrollSaved'), approved: t('actualWorkPayrollApproved'), released: t('actualWorkPayrollReleased'),
    needsReview: t('actualWorkPayrollNeedsReview'), approve: t('actualWorkPayrollApprove'), release: t('actualWorkPayrollRelease'),
    mappingTitle: t('actualWorkPayrollMappingTitle'), type: t('actualWorkType'), target: t('actualWorkPayrollTarget'),
    payment: t('actualWorkPayrollPayment'), premium: t('actualWorkPayrollPremium'), tvt: t('actualWorkPayrollTvt'), tvtSourceGap: t('actualWorkPayrollTvtSourceGap'),
    informational: t('actualWorkPayrollInformational'), factor: t('actualWorkPayrollFactor'), validFrom: t('actualWorkPayrollValidFrom'),
    saveMapping: t('actualWorkPayrollSaveMapping'), done: t('actualWorkPayrollDone'), failed: t('actualWorkPayrollFailed'),
    importSaved: t('actualWorkPayrollImportSaved'), approvedSaved: t('actualWorkPayrollApprovedSaved'),
    releasedSaved: t('actualWorkPayrollReleasedSaved'), administration: t('actualWorkPayrollAdministration'),
    sourceGap: t('actualWorkPayrollSourceGap'), twkRequired: t('actualWorkPayrollTwkRequired'),
    csvEmployee: t('actualWorkPayrollCsvEmployee'), csvEmployment: t('actualWorkPayrollCsvEmployment'),
    csvType: t('actualWorkPayrollCsvType'), csvPeriod: t('actualWorkPayrollCsvPeriod'),
    csvHours: t('actualWorkPayrollCsvHours'), csvColumn: t('actualWorkPayrollCsvColumn'),
    csvComment: t('actualWorkPayrollCsvComment'), csvReference: t('actualWorkPayrollCsvReference'),
    payrollComponent: t('actualWorkPayrollComponent'),
  }} />
}
