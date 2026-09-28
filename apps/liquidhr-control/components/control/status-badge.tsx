import type { TenantLifecycleStatus } from '@/lib/control/lifecycle'
import { getDictionary } from '@/lib/i18n/dictionary'
import { Badge, type BadgeTone } from '@/components/ui/badge'

const tones: Record<TenantLifecycleStatus, BadgeTone> = {
  PROVISIONING: 'warning',
  ACTIVE: 'success',
  PAUSED: 'danger',
  TERMINATING: 'warning',
  TERMINATED: 'neutral',
}

export function StatusBadge({ status }: { status: TenantLifecycleStatus }) {
  return <Badge tone={tones[status]}>{getDictionary().status[status]}</Badge>
}
