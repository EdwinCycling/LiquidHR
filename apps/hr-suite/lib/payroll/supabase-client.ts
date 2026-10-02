import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { PayrollDatabase } from './database'

// Prevent a misconfigured Payroll URL from sending service-role calls to the
// canonical LiquidHR Supabase project. Keep this ref aligned with the Core
// project documented by this workspace; PAYROLL_* remain the only Payroll
// runtime configuration variables.
const LIQUIDHR_CORE_SUPABASE_HOST = 'wnpfloqpjvaacobppbpk.supabase.co'
const PAYROLL_LAB_SUPABASE_HOST = 'jhgeriucbkfarxiudzfy.supabase.co'

export class PayrollDatabaseConfigurationError extends Error {
  constructor() {
    super('Payroll Lab database configuration is unavailable.')
    this.name = 'PayrollDatabaseConfigurationError'
  }
}

export function createPayrollSupabaseClient() {
  const url = process.env.PAYROLL_SUPABASE_URL
  const secretKey = process.env.PAYROLL_SUPABASE_SECRET_KEY

  if (!url || !secretKey || !secretKey.trim()) throw new PayrollDatabaseConfigurationError()

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new PayrollDatabaseConfigurationError()
  }

  if (
    parsedUrl.protocol !== 'https:'
    || parsedUrl.hostname.toLowerCase() === LIQUIDHR_CORE_SUPABASE_HOST
    || parsedUrl.hostname.toLowerCase() !== PAYROLL_LAB_SUPABASE_HOST
    || parsedUrl.username !== '' || parsedUrl.password !== ''
    || parsedUrl.port !== '' || parsedUrl.pathname !== '/'
    || parsedUrl.search !== '' || parsedUrl.hash !== ''
  ) {
    throw new PayrollDatabaseConfigurationError()
  }

  return createClient<PayrollDatabase>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}
