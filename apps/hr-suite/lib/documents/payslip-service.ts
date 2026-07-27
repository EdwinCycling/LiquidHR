import 'server-only'

import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'payslips'

export class PayslipServiceError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'PayslipServiceError'
  }
}

export async function listEmployeePayslips(employeeId: string) {
  await requirePermission('payslip:read', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('payslips')
    .select('id, employment_id, period_label, calendar_year, original_filename, content_type, file_size, import_source, imported_at')
    .eq('employee_id', employeeId)
    .order('calendar_year', { ascending: false })
    .order('imported_at', { ascending: false })
    .limit(200)
  if (error) throw new PayslipServiceError('PAYSLIP_READ_FAILED', 500)
  return data
}

export async function createPayslipDownload(employeeId: string, payslipId: string): Promise<string> {
  await requirePermission('payslip:read', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('payslips').select('storage_key').eq('id', payslipId).eq('employee_id', employeeId).maybeSingle()
  if (error || !data) throw new PayslipServiceError('PAYSLIP_NOT_FOUND', 404)
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(data.storage_key, 60)
  if (signed.error) throw new PayslipServiceError('PAYSLIP_DOWNLOAD_FAILED', 500)
  return signed.data.signedUrl
}
