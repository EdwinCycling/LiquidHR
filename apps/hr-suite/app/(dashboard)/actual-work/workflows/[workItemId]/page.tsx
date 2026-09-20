import Link from 'next/link'
import { redirect } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getProcessWorkItemDetail } from '@/lib/process-automation/work-service'

interface Props {
  readonly params: Promise<{ workItemId: string }>
}

function statusLabel(status: string, t: (key: string) => string): string {
  return {
    OPEN: t('statusOpen'),
    WAITING: t('statusWaiting'),
    IN_PROGRESS: t('statusInProgress'),
    CHANGES_REQUESTED: t('statusChangesRequested'),
    COMPLETED: t('statusCompleted'),
    REJECTED: t('statusRejected'),
    CANCELLED: t('statusCancelled'),
  }[status] ?? status
}

function statusTone(status: string): BadgeTone {
  if (status === 'COMPLETED') return 'success'
  if (status === 'REJECTED' || status === 'CANCELLED') return 'warning'
  if (status === 'OPEN' || status === 'IN_PROGRESS') return 'info'
  return 'neutral'
}

export default async function ActualWorkWorkflowPage({ params }: Props) {
  const { workItemId } = await params
  const locale = await getLocale()
  const [detail, t, workflow] = await Promise.all([
    getProcessWorkItemDetail(workItemId, locale),
    getTranslator('employees'),
    getTranslator('processAutomation'),
  ])
  if (detail.businessType !== 'ACTUAL_WORK') redirect(`/work/${workItemId}`)

  const openRecordHref = detail.subjectEmployeeId
    ? `/employees/${detail.subjectEmployeeId}/hours`
    : '/actual-work/team'
  const categoryLabel = detail.businessCategory === 'ACTUAL_WORK_ENTRY'
    ? t('actualWorkWorkflowEntry')
    : detail.businessCategory

  return (
    <PageShell className="py-8" width="wide">
      <Link className={buttonClasses({ size: 'sm', variant: 'ghost', className: 'mb-4 -ml-3' })} href="/work">{t('actualWorkWorkflowBack')}</Link>
      <PageHeader
        actions={<Badge tone={statusTone(detail.businessStatus)}>{statusLabel(detail.businessStatus, workflow)}</Badge>}
        description={detail.processDescription ?? t('actualWorkWorkflowDescription')}
        title={(
          <div>
            <span className="eyebrow mb-1 block">{t('actualWorkWorkflowEyebrow')}</span>
            <span>{detail.processTitle}</span>
          </div>
        )}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Surface className="p-5">
          <h2 className="text-xl font-semibold">{t('actualWorkWorkflowContext')}</h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">{t('actualWorkWorkflowSubject')}</dt><dd className="mt-1 font-semibold">{detail.subjectName ?? t('actualWorkWorkflowNoSubject')}</dd></div>
            <div><dt className="text-muted-foreground">{t('actualWorkWorkflowStep')}</dt><dd className="mt-1 font-semibold">{detail.stepTitle}</dd></div>
            <div><dt className="text-muted-foreground">{t('actualWorkWorkflowCategory')}</dt><dd className="mt-1 font-semibold">{categoryLabel}</dd></div>
            <div><dt className="text-muted-foreground">{t('actualWorkWorkflowAssignment')}</dt><dd className="mt-1 font-semibold">{detail.assignmentExplanation.roleCode ?? detail.participantKey}</dd></div>
          </dl>
        </Surface>
        <Surface className="p-5">
          <h2 className="text-xl font-semibold">{t('actualWorkWorkflowNativeBoundary')}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{t('actualWorkWorkflowDescription')}</p>
          <Link className={`${buttonClasses({ size: 'sm', variant: 'secondary' })} mt-5`} href={openRecordHref}>{t('actualWorkWorkflowOpenRecord')}</Link>
        </Surface>
      </div>
    </PageShell>
  )
}
