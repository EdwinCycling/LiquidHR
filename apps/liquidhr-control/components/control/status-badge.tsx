import type { TenantLifecycleStatus } from '@/lib/control/lifecycle'
import { getDictionary } from '@/lib/i18n/dictionary'

const styles: Record<TenantLifecycleStatus, string> = {
  PROVISIONING: 'bg-warning-soft text-warning',
  ACTIVE: 'bg-success-soft text-success',
  PAUSED: 'bg-danger-soft text-danger',
  TERMINATING: 'bg-warning-soft text-warning',
  TERMINATED: 'bg-muted text-muted-foreground',
}

export function StatusBadge({ status }: { status: TenantLifecycleStatus }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${styles[status]}`}>{getDictionary().status[status]}</span>
}
