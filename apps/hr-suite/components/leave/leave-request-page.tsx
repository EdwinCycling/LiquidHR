'use client'

import { useRouter } from 'next/navigation'

import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { LeaveRequestDialog, type LeaveRequestDialogLabels } from '@/components/hr-calendar/leave-request-dialog'
import type { Locale } from '@/lib/i18n/config'

export interface LeaveRequestPageLabels extends LeaveRequestDialogLabels {
  readonly eyebrow: string
  readonly pageTitle: string
  readonly pageDescription: string
}

interface Props {
  readonly employeeId: string
  readonly locale: Locale
  readonly labels: LeaveRequestPageLabels
}

export function LeaveRequestPage({ employeeId, locale, labels }: Props) {
  const router = useRouter()
  const startDate = new Date().toISOString().slice(0, 10)
  const back = () => router.push('/work?view=REQUESTS')

  return (
    <PageShell className="py-8" width="wide">
      <PageHeader
        description={labels.pageDescription}
        title={(
          <div>
            <span className="eyebrow mb-1 block">{labels.eyebrow}</span>
            <span>{labels.pageTitle}</span>
          </div>
        )}
      />
      <LeaveRequestDialog
        allowStartDateChange
        employeeId={employeeId}
        initialMode="PRIORITY"
        labels={labels}
        locale={locale}
        onClose={back}
        onSuccess={back}
        previewPath="/api/leave/workflow/preview"
        startDate={startDate}
        submitPath="/api/leave/workflow"
      />
    </PageShell>
  )
}
