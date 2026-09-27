'use client'

import { useRouter } from 'next/navigation'
import { LeaveRequestDialog, type LeaveRequestDialogLabels } from '@/components/hr-calendar/leave-request-dialog'
import type { Locale } from '@/lib/i18n/config'

export function FocusLeaveRequest({ employeeId, locale, labels }: { employeeId: string; locale: Locale; labels: LeaveRequestDialogLabels }) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  return <LeaveRequestDialog allowStartDateChange employeeId={employeeId} initialMode="PRIORITY" labels={labels} locale={locale} onClose={() => router.push('/focus/verlof')} onSuccess={() => router.push('/focus/verlof')} previewPath="/api/focus/leave/preview" startDate={today} submitPath="/api/focus/leave" />
}
