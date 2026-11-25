import 'server-only'

import { z } from 'zod'
import { createAdminRpcClient } from '@/lib/supabase/admin'

const resultSchema = z.number().int().nonnegative()

export class PerformanceReviewSchedulerError extends Error {
  constructor(readonly code: 'PERFORMANCE_REVIEW_SCHEDULER_FAILED') {
    super(code)
    this.name = 'PerformanceReviewSchedulerError'
  }
}

export async function runDuePerformanceReviewActivations(): Promise<{ activated: number }> {
  const supabase = createAdminRpcClient()
  const { data, error } = await supabase.rpc('run_due_performance_review_activations')
  if (error) throw new PerformanceReviewSchedulerError('PERFORMANCE_REVIEW_SCHEDULER_FAILED')
  const parsed = resultSchema.safeParse(data)
  if (!parsed.success) throw new PerformanceReviewSchedulerError('PERFORMANCE_REVIEW_SCHEDULER_FAILED')
  return { activated: parsed.data }
}
