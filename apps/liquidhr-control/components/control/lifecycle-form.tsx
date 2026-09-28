import { changeTenantLifecycle } from '@/lib/control/actions'
import { allowedTenantTransitions, type TenantLifecycleStatus } from '@/lib/control/lifecycle'
import { getDictionary } from '@/lib/i18n/dictionary'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/patterns/form-field'

export function LifecycleForm({ tenantId, status }: { tenantId: string; status: TenantLifecycleStatus }) {
  const dictionary = getDictionary()
  const transitions = allowedTenantTransitions(status)
  if (transitions.length === 0) return <p className="mt-5 text-sm text-muted-foreground">{dictionary.tenant.noTransition}</p>
  return <form action={changeTenantLifecycle} className="mt-5 space-y-4"><input name="tenantId" type="hidden" value={tenantId} /><FormField label={dictionary.tenant.status}><DropdownSelect name="status" required searchPlaceholder={dictionary.common.search}>{transitions.map((transition) => <option key={transition} value={transition}>{dictionary.actions[transition]}</option>)}</DropdownSelect></FormField><FormField label={dictionary.tenant.reason}><Textarea minLength={5} name="reason" placeholder={dictionary.tenant.reasonPlaceholder} required /></FormField><Button className="w-full" type="submit">{dictionary.tenant.confirm}</Button></form>
}
