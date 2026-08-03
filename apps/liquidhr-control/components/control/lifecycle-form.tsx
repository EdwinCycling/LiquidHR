import { changeTenantLifecycle } from '@/lib/control/actions'
import { allowedTenantTransitions, type TenantLifecycleStatus } from '@/lib/control/lifecycle'
import { getDictionary } from '@/lib/i18n/dictionary'

export function LifecycleForm({ tenantId, status }: { tenantId: string; status: TenantLifecycleStatus }) {
  const dictionary = getDictionary()
  const transitions = allowedTenantTransitions(status)
  if (transitions.length === 0) return <p className="mt-5 text-sm text-muted-foreground">{dictionary.tenant.noTransition}</p>
  return <form action={changeTenantLifecycle} className="mt-5 space-y-4"><input name="tenantId" type="hidden" value={tenantId} /><label className="block text-sm font-semibold">{dictionary.tenant.status}<select className="mt-2 h-11 w-full rounded-xl border border-border bg-panel-soft px-3" name="status" required>{transitions.map((transition) => <option key={transition} value={transition}>{dictionary.actions[transition]}</option>)}</select></label><label className="block text-sm font-semibold">{dictionary.tenant.reason}<textarea className="mt-2 min-h-24 w-full resize-y rounded-xl border border-border bg-panel-soft p-3 outline-none focus:border-primary" minLength={5} name="reason" placeholder={dictionary.tenant.reasonPlaceholder} required /></label><button className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground" type="submit">{dictionary.tenant.confirm}</button></form>
}
