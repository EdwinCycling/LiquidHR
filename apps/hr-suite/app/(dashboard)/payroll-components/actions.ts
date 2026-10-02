'use server'

import { redirect } from 'next/navigation'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { ContextAccessError } from '@/lib/context/administration-context'
import { copySystemComponent } from '@/lib/payroll/component-library'

export async function copySystemComponentAction(formData: FormData): Promise<never> {
  let destination = '/payroll-components?error=copy-failed'
  try {
    // Reject additional fields rather than allowing client-owned scope/definition overrides.
    const fields = Array.from(formData.keys()).filter(key => !key.startsWith('$ACTION_'))
    const catalogKey = formData.get('catalogKey')
    if (fields.length === 1 && fields[0] === 'catalogKey' && typeof catalogKey === 'string' && catalogKey.length <= 300) {
      const draft = await copySystemComponent(catalogKey)
      if (/^[0-9a-f-]{36}$/i.test(draft.id)) {
        destination = `/payroll-components?component=${encodeURIComponent(`draft::${draft.id}`)}&ownership=customer&saved=1`
      }
    }
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) destination = '/login'
    else if (error instanceof AuthorizationError || error instanceof ContextAccessError) destination = '/geen-toegang'
    // Errors intentionally contain no database or definition payload in the redirect.
  }
  redirect(destination)
}
