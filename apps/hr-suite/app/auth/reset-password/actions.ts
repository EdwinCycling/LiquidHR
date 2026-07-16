'use server'

import { passwordResetSchema } from '@/lib/auth/password-reset-rules'
import { createClient } from '@/lib/supabase/server'

export interface PasswordResetActionState {
  code: 'idle' | 'invalid' | 'missingSession' | 'failed' | 'updated'
}

export async function updatePasswordAction(
  _previousState: PasswordResetActionState,
  formData: FormData,
): Promise<PasswordResetActionState> {
  const parsed = passwordResetSchema.safeParse({
    password: formData.get('password'),
    passwordConfirmation: formData.get('passwordConfirmation'),
  })
  if (!parsed.success) return { code: 'invalid' }

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) return { code: 'missingSession' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  return error ? { code: 'failed' } : { code: 'updated' }
}
