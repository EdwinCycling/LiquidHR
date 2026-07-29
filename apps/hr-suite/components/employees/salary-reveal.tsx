'use client'

import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

interface SalaryValue {
  amount: number
  currencyCode: string
  paymentType: 'PERIODIC_FIXED' | 'HOURLY_VARIABLE'
}

interface Labels {
  hidden: string
  loading: string
  failed: string
  monthly: string
  hourly: string
  notAvailable: string
}

export function SalaryReveal({ employeeId, employmentId, locale, canRead, labels }: { employeeId: string; employmentId?: string; locale: string; canRead: boolean; labels: Labels }) {
  const [value, setValue] = useState<SalaryValue | null>(null)
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  async function reveal(): Promise<void> {
    setActive(true)
    if (value || loading || failed || !canRead) return
    setLoading(true)
    const query = employmentId ? `?employmentId=${encodeURIComponent(employmentId)}` : ''
    const response = await fetch(`/api/employees/${employeeId}/salary${query}`, { cache: 'no-store' })
    if (!response.ok) setFailed(true)
    else {
      const result = await response.json() as { data?: SalaryValue | null }
      setValue(result.data ?? null)
    }
    setLoading(false)
  }

  if (!canRead) return <span className="text-sm font-semibold text-muted-foreground">{labels.notAvailable}</span>
  const formatted = value ? new Intl.NumberFormat(locale, { style: 'currency', currency: value.currencyCode }).format(value.amount) : null
  const suffix = value?.paymentType === 'HOURLY_VARIABLE' ? labels.hourly : labels.monthly
  return <span className="inline-flex min-w-28 flex-col gap-1" onBlur={() => setActive(false)} onFocus={() => void reveal()} onMouseEnter={() => void reveal()} onMouseLeave={() => setActive(false)}>
    <span className="inline-flex items-center gap-2 text-sm font-semibold" title={active && formatted ? formatted : labels.hidden}>
      {active && formatted ? <span>{formatted}</span> : <span aria-label={labels.hidden} className="tracking-[0.25em] text-muted-foreground">••••••</span>}
      {loading ? <LoaderCircle aria-label={labels.loading} className="animate-spin text-muted-foreground" size={14} /> : active ? <Eye aria-hidden="true" size={14} /> : <EyeOff aria-hidden="true" size={14} />}
    </span>
    {active && formatted ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
    {failed ? <span className="text-xs text-destructive">{labels.failed}</span> : null}
  </span>
}
