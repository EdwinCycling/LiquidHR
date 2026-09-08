import { notFound, redirect } from 'next/navigation'
import { AuthorizationError } from '@/lib/auth/permissions'
import { ModuleError } from '@/lib/modules/module-service'
import { getTranslator } from '@/lib/i18n/server'
import { getPayrollWorkspaceData } from '@/lib/payroll/payroll-service'
import { createPayrollLabels, PayrollWorkspace } from '@/components/payroll/payroll-workspace'
import type { Translator } from '@/lib/i18n/translator'
import type { PayrollWorkspaceData } from '@/lib/payroll/payroll-service'

async function loadPayrollPage(): Promise<[PayrollWorkspaceData, Translator]> {
  try { return await Promise.all([getPayrollWorkspaceData(), getTranslator('payroll')]) } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); if (error instanceof ModuleError && error.status === 404) notFound(); throw error }
}

export default async function PayrollOverviewPage() {
  const [data, labels] = await loadPayrollPage()
  return <PayrollWorkspace active="overview" data={data} labels={createPayrollLabels(labels)} />
}
