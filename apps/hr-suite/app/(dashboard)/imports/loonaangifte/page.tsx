import { redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PayrollImportWizard } from '@/components/payroll-import/payroll-import-wizard'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listRecoverablePayrollImports } from '@/lib/payroll-import/service'

export default async function LoonaangifteImportPage() {
  const [{ activeContext, context }, translate] = await Promise.all([getRequestAuthorizationContext(), getTranslator('payrollImport')])
  if (!context.permissions.includes('payroll-import:write')) redirect('/geen-toegang')
  const administrationId = activeContext.activeAdministration?.id ?? context.administrationId
  let recoverableImports: Awaited<ReturnType<typeof listRecoverablePayrollImports>> = []
  let recoveryError = false
  if (administrationId) {
    try {
      recoverableImports = await listRecoverablePayrollImports(administrationId)
    } catch {
      recoveryError = true
    }
  }
  const keys = ['title', 'description', 'eyebrow', 'sourceType', 'loonaangifteXml', 'internalRepresentative', 'taxYear', 'periodStart', 'periodEnd', 'file', 'chooseFile', 'fixtureHint', 'analyze', 'analyzing', 'back', 'next', 'previousSteps', 'nextSteps', 'confirmPreview', 'finalize', 'finalizing', 'analysisTitle', 'previewNoWrites', 'total', 'green', 'warnings', 'blocking', 'row', 'status', 'match', 'issues', 'select', 'emptyValue', 'status_GREEN', 'status_WARNING', 'status_BLOCKING', 'match_EXACT', 'match_PROPOSED', 'match_MANUAL_REVIEW', 'match_NEW', 'match_UNMATCHED', 'issue_FIRST_NAME_REQUIRED', 'issue_BIRTH_NAME_REQUIRED', 'issue_BIRTH_DATE_INVALID', 'issue_DUPLICATE_EXTERNAL_EMPLOYEE_NUMBER', 'issue_LHNR_INVALID', 'issue_LHNR_SCOPE_MISMATCH', 'issue_DUPLICATE_IKV', 'issue_IKV_NUMBER_INVALID', 'issue_INCOME_IKV_NUMBER_INVALID', 'issue_INCOME_DATE_RANGE_INVALID', 'issue_INCOME_START_DATE_REQUIRED', 'issue_INCOME_START_DATE_INVALID', 'issue_INCOME_END_DATE_INVALID', 'issue_AMBIGUOUS_EMPLOYEE_MATCH', 'issue_EMPLOYEE_MATCH_REQUIRES_CONFIRMATION', 'issue_NEW_EMPLOYEE_INCOMPLETE', 'warning_REVIEW_REQUIRED', 'warning_FIRST_NAME_REQUIRED', 'warning_EMPLOYEE_CREATE_FAILED', 'warning_EMPLOYMENT_DRAFT_REQUIRES_CONTRACT_MAPPING', 'warning_EMPLOYMENT_CREATE_FAILED', 'unknownWarning', 'staged', 'reportTitle', 'employeesImported', 'employmentsCreated', 'incomeRelationshipsImported', 'warningsTitle', 'noWarnings', 'noActiveAdministration', 'error', 'xsdPending', 'convergenceRequired', 'recoverTitle', 'recoverDescription', 'recoverBatch', 'recoverResume', 'recoverMissingEmployment', 'recoverPendingIncome', 'recoverFinalizationNotice', 'recoverReadError', 'stepExplanation', 'stepPreflight', 'stepFile', 'stepAnalyze', 'stepEmployer', 'stepPeople', 'stepSelect', 'stepPerson', 'stepConflicts', 'stepPreview', 'stepFinal', 'stepReport']
  const labels = Object.fromEntries(keys.map((key) => [key, translate(key)])) as Record<string, string>
  return <PageShell className="space-y-6 py-7 lg:py-10" width="wide"><header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{labels.eyebrow}</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{labels.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{labels.description}</p></header><PayrollImportWizard administrationId={administrationId} labels={labels} initialRecoverableImports={recoverableImports} initialRecoveryError={recoveryError} /></PageShell>
}
