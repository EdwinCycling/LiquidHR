import type { SupabaseClient } from '@supabase/supabase-js'
import type { PayrollDatabase } from './database'

export type PayrollSupabaseClient = SupabaseClient<PayrollDatabase>
