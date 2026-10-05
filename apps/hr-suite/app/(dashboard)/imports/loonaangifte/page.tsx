import { redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PayrollImportWizard } from '@/components/payroll-import/payroll-import-wizard'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { getPayrollImportReadiness } from '@/lib/payroll-import/readiness'
import { listRecoverablePayrollImports } from '@/lib/payroll-import/service'

export default async function LoonaangifteImportPage() {
  const [{ activeContext, context, supabase }, translate] = await Promise.all([getRequestAuthorizationContext(), getTranslator('payrollImport')])
  if (!context.permissions.includes('payroll-import:write')) redirect('/geen-toegang')
  const administrationId = activeContext.activeAdministration?.id ?? context.administrationId
  let recoverableImports: Awaited<ReturnType<typeof listRecoverablePayrollImports>> = []
  let recoveryError = false
  let initialReadiness: {
    status: 'READY' | 'WARNING' | 'BLOCKED' | 'NOT_REQUIRED'
    isReady: boolean
    payrollTaxNumber: string | null
    checks: Array<{ key: string; status: 'READY' | 'WARNING' | 'BLOCKED' | 'NOT_REQUIRED'; code?: string }>
  } | null = null
  let readinessError = false
  if (administrationId) {
    try {
      recoverableImports = await listRecoverablePayrollImports(administrationId)
    } catch {
      recoveryError = true
    }
    try {
      const readiness = await getPayrollImportReadiness({ dependencies: { auth: context, supabase } })
      initialReadiness = {
        status: readiness.status,
        isReady: readiness.isReady,
        payrollTaxNumber: readiness.payrollTaxNumber,
        checks: readiness.checks.map(({ key, status, code }) => ({ key, status, ...(code ? { code } : {}) })),
      }
    } catch {
      readinessError = true
    }
  }
  const keys = ['title', 'description', 'eyebrow', 'sourceType', 'loonaangifteXml', 'internalRepresentative', 'taxYear', 'periodStart', 'periodEnd', 'file', 'chooseFile', 'fixtureHint', 'analyze', 'analyzing', 'back', 'next', 'previousSteps', 'nextSteps', 'confirmPreview', 'finalize', 'finalizing', 'analysisTitle', 'previewNoWrites', 'xmlPreviewTitle', 'xmlPreviewDescription', 'xmlReadOnlyNotice', 'xmlReadOnlyError', 'readinessTitle', 'readinessDescription', 'readinessStatus', 'readinessReady', 'readinessWarning', 'readinessBlocked', 'readinessNotRequired', 'readinessPayrollTaxNumber', 'readinessCheck_ACTIVE_HR_GROUP', 'readinessCheck_ACTIVE_ADMINISTRATION', 'readinessCheck_IMPORT_PERMISSION', 'readinessCheck_PAYROLL_TAX_NUMBER', 'readinessCheck_SOURCE_SUPPORT', 'readinessCheck_SOURCE_LHNR_PERIOD', 'readinessCheckStatusReady', 'readinessCheckStatusWarning', 'readinessCheckStatusBlocked', 'readinessCheckStatusNotRequired', 'readinessUnknownCheck', 'readinessReadError', 'total', 'green', 'warnings', 'blocking', 'row', 'status', 'match', 'issues', 'select', 'emptyValue', 'status_GREEN', 'status_WARNING', 'status_BLOCKING', 'match_EXACT', 'match_PROPOSED', 'match_MANUAL_REVIEW', 'match_NEW', 'match_UNMATCHED', 'issue_FIRST_NAME_REQUIRED', 'issue_BIRTH_NAME_REQUIRED', 'issue_BIRTH_DATE_INVALID', 'issue_DUPLICATE_EXTERNAL_EMPLOYEE_NUMBER', 'issue_LHNR_INVALID', 'issue_LHNR_SCOPE_MISMATCH', 'issue_DUPLICATE_IKV', 'issue_IKV_NUMBER_INVALID', 'issue_INCOME_IKV_NUMBER_INVALID', 'issue_INCOME_DATE_RANGE_INVALID', 'issue_INCOME_START_DATE_REQUIRED', 'issue_INCOME_START_DATE_INVALID', 'issue_INCOME_END_DATE_INVALID', 'issue_AMBIGUOUS_EMPLOYEE_MATCH', 'issue_EMPLOYEE_MATCH_REQUIRES_CONFIRMATION', 'issue_NEW_EMPLOYEE_INCOMPLETE', 'warning_REVIEW_REQUIRED', 'warning_FIRST_NAME_REQUIRED', 'warning_EMPLOYEE_CREATE_FAILED', 'warning_EMPLOYMENT_DRAFT_REQUIRES_CONTRACT_MAPPING', 'warning_EMPLOYMENT_CREATE_FAILED', 'unknownWarning', 'staged', 'reportTitle', 'employeesImported', 'employmentsCreated', 'incomeRelationshipsImported', 'warningsTitle', 'noWarnings', 'noActiveAdministration', 'error', 'xmlFinalizationPending', 'convergenceRequired', 'xmlXsdValidated', 'recoverTitle', 'recoverDescription', 'recoverBatch', 'recoverResume', 'recoverMissingEmployment', 'recoverPendingIncome', 'recoverFinalizationNotice', 'recoverReadError', 'stepExplanation', 'stepPreflight', 'stepFile', 'stepAnalyze', 'stepEmployer', 'stepPeople', 'stepSelect', 'stepPerson', 'stepConflicts', 'stepPreview', 'stepFinal', 'stepReport']
  const extraKeys = [
    'readinessCodeUnknown', 'readinessCode_SOURCE_REJECTED', 'readinessCode_SOURCE_GAP', 'readinessCode_IMPORT_TAX_YEAR_SELECTION_MISMATCH', 'readinessCode_SOURCE_FORMAL_VALIDATION_PENDING',
    'readinessCode_SOURCE_NAMESPACE_REQUIRED', 'readinessCode_SOURCE_TAX_YEAR_REQUIRED', 'readinessCode_SOURCE_TAX_YEAR_INVALID', 'readinessCode_IMPORT_PERIOD_REQUIRED', 'readinessCode_IMPORT_PERIOD_INVALID',
    'readinessCode_IMPORT_PERIOD_YEAR_MISMATCH', 'readinessCode_LHNR_INVALID', 'readinessCode_LHNR_BINDING_REQUIRED', 'readinessCode_LHNR_BINDING_INVALID', 'readinessCode_LHNR_BINDING_AMBIGUOUS',
    'readinessCode_LHNR_PERIOD_NOT_COVERED', 'readinessCode_LHNR_SCOPE_MISMATCH', 'readinessCode_LHNR_PRIMARY_BINDING_REQUIRED',
    'xmlSourceDetails', 'xmlSchemaVersion', 'xmlPayrollTaxNumber', 'xmlReportingPeriods', 'xmlNoReportingPeriods', 'xmlIncomeRelationships', 'xmlIkvNumber', 'xmlStartsOn', 'xmlEndsOn', 'xmlIncomePeriod', 'xmlIncomeCode',
    'xmlParseStatus_SUPPORTED_READ_ONLY', 'xmlParseStatus_SOURCE_GAP', 'xmlParseStatus_REJECTED', 'xmlParseStatusUnknown', 'xmlDiagnosticUnknown', 'xmlDiagnostic_XML_MALFORMED', 'xmlDiagnostic_XML_UNSAFE_DOCTYPE',
    'xmlDiagnostic_XML_UNSAFE_ENTITY', 'xmlDiagnostic_XML_TOO_LARGE', 'xmlDiagnostic_XML_TOO_DEEP', 'xmlDiagnostic_XML_TOO_MANY_NODES', 'xmlDiagnostic_XML_NAMESPACE_UNBOUND', 'xmlDiagnostic_UNSUPPORTED_YEAR',
    'xmlDiagnostic_UNSUPPORTED_NAMESPACE', 'xmlDiagnostic_UNSUPPORTED_ROOT', 'xmlDiagnostic_UNSUPPORTED_SCHEMA_VERSION', 'xmlDiagnostic_XSD_UNAVAILABLE', 'xmlDiagnostic_XML_XSD_INVALID', 'xmlDiagnostic_SOURCE_CONTRACT_UNSUPPORTED', 'xmlDiagnostic_MALFORMED_VALUE',
    'xmlDiagnostic_IDENTIFIER_PROTECTION_REQUIRED', 'xmlXsdValidated', 'issue_XML_PERSON_FIELD_CONFLICT', 'issue_XML_EMPLOYEE_MATCH_CONTRACT_PENDING',
  ]
  const labels = Object.fromEntries([...keys, ...extraKeys].map((key) => [key, translate(key)])) as Record<string, string>
  return <PageShell className="space-y-6 py-7 lg:py-10" width="wide"><header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{labels.eyebrow}</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{labels.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{labels.description}</p></header><PayrollImportWizard administrationId={administrationId} labels={labels} initialReadiness={initialReadiness} initialReadinessError={readinessError} initialRecoverableImports={recoverableImports} initialRecoveryError={recoveryError} /></PageShell>
}
