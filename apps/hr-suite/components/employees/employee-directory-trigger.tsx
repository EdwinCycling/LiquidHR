'use client'

import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { EmployeeDirectoryDetail } from '@/lib/employee-directory/service'

interface Labels {
  loading: string
  close: string
  unavailable: string
  job: string
  department: string
  email: string
  phone: string
  presence: string
  schedule: string
  working: string
  off: string
  absent: string
  noDetails: string
}

export function EmployeeDirectoryTrigger({ employeeId, ariaLabel, children, labels }: { employeeId: string; ariaLabel: string; children?: ReactNode; labels: Labels }) {
  const [detail, setDetail] = useState<EmployeeDirectoryDetail | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  async function show(): Promise<void> {
    setOpen(true)
    setFailed(false)
    if (detail) return
    setLoading(true)
    const response = await fetch(`/api/employees/${employeeId}/directory`, { cache: 'no-store' })
    if (!response.ok) setFailed(true)
    else setDetail(await response.json() as EmployeeDirectoryDetail)
    setLoading(false)
  }

  return <>
    <button aria-label={ariaLabel} className="absolute inset-0 z-0 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={() => void show()} type="button" />
    {children}
    {open ? <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4" role="dialog">
      <div className="max-h-[min(720px,calc(100vh-2rem))] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-surface p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="eyebrow">{labels.noDetails}</p><h2 className="mt-1 text-2xl font-semibold">{detail?.name ?? ariaLabel}</h2></div>
          <button aria-label={labels.close} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" onClick={() => setOpen(false)} type="button"><X size={18} /></button>
        </div>
        {loading ? <p className="mt-6 text-sm text-muted-foreground">{labels.loading}</p> : failed ? <p className="mt-6 rounded-xl bg-destructive-surface p-4 text-sm text-destructive">{labels.unavailable}</p> : detail ? <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {detail.jobTitle !== undefined ? <Info label={labels.job} value={detail.jobTitle} /> : null}
            {detail.departmentName !== undefined ? <Info label={labels.department} value={detail.departmentName} /> : null}
            {detail.workEmail !== undefined ? <Info label={labels.email} value={detail.workEmail} /> : null}
            {detail.workPhone !== undefined ? <Info label={labels.phone} value={detail.workPhone} /> : null}
          </div>
          {detail.presence ? <section><h3 className="font-semibold">{labels.presence}</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{detail.presence.map((day) => <div className="rounded-xl border bg-background p-3 text-center" key={day.date}><p className="text-xs font-semibold uppercase text-muted-foreground">{new Intl.DateTimeFormat('nl-NL', { weekday: 'short' }).format(new Date(`${day.date}T12:00:00Z`))}</p><p className={`mt-2 text-xs font-semibold ${day.status === 'ABSENT' ? 'text-destructive' : day.status === 'WORKING' ? 'text-success' : 'text-muted-foreground'}`}>{day.status === 'WORKING' ? labels.working : day.status === 'ABSENT' ? labels.absent : labels.off}</p></div>)}</div></section> : null}
          {detail.schedule ? <section><h3 className="font-semibold">{labels.schedule}</h3><div className="mt-3 divide-y rounded-xl border bg-background">{detail.schedule.filter((day) => day.isWorkingDay).map((day) => <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm" key={`${day.weekIndex}-${day.isoWeekday}`}><span>{new Intl.DateTimeFormat('nl-NL', { weekday: 'long' }).format(new Date(Date.UTC(2024, 0, day.isoWeekday)))}</span><span className="font-medium">{day.startsAt && day.endsAt ? `${day.startsAt.slice(0, 5)} – ${day.endsAt.slice(0, 5)}` : `${(day.scheduledMinutes / 60).toLocaleString('nl-NL')} uur`}</span></div>)}</div></section> : null}
        </div> : null}
      </div>
    </div> : null}
  </>
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value || '—'}</p></div>
}
