'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

const snapshotSchema = z.object({
  departmentName: z.string().nullable().optional(),
  departmentCode: z.string().nullable().optional(),
  jobName: z.string().nullable().optional(),
  jobCode: z.string().nullable().optional(),
  managerName: z.string().nullable().optional(),
}).passthrough()

const previewSchema = z.object({
  status: z.enum(['SUCCESS', 'WARNING', 'BLOCKING']),
  writesPerformed: z.literal(false),
  current: snapshotSchema,
  proposed: snapshotSchema,
  blockers: z.array(z.object({ code: z.string(), candidateCount: z.number().int().nonnegative().optional() }).passthrough()),
  warnings: z.array(z.object({ code: z.string(), candidateCount: z.number().int().nonnegative().optional() }).passthrough()),
  reason: z.string(),
}).passthrough()

type Preview = z.infer<typeof previewSchema>

export interface InternalTransferCommitPanelLabels {
  readonly preview: string
  readonly previewDescription: string
  readonly current: string
  readonly proposed: string
  readonly department: string
  readonly job: string
  readonly manager: string
  readonly blockers: string
  readonly warnings: string
  readonly previewSuccess: string
  readonly previewWarning: string
  readonly previewBlocking: string
  readonly commit: string
  readonly commitConfirm: string
  readonly committing: string
  readonly commitFailed: string
  readonly changed: string
  readonly noSalary: string
  readonly loading: string
  readonly failed: string
  readonly cancel: string
  readonly noValue: string
}

function labelForIssue(code: string, labels: InternalTransferCommitPanelLabels): string {
  if (code === 'SALARY_UNCHANGED') return labels.noSalary
  return code === 'NO_TARGET_MANAGER' ? labels.previewBlocking : code
}

function Snapshot({ title, snapshot, labels }: { readonly title: string; readonly snapshot: Preview['current']; readonly labels: InternalTransferCommitPanelLabels }) {
  const value = (primary: string | null | undefined, fallback?: string | null): string => primary ?? fallback ?? labels.noValue
  return <div className="rounded-xl border border-border bg-panel-soft p-4">
    <h3 className="font-semibold">{title}</h3>
    <dl className="mt-3 grid gap-3 text-sm">
      <div><dt className="text-muted-foreground">{labels.department}</dt><dd className="mt-1 font-medium">{value(snapshot.departmentName, snapshot.departmentCode)}</dd></div>
      <div><dt className="text-muted-foreground">{labels.job}</dt><dd className="mt-1 font-medium">{value(snapshot.jobName, snapshot.jobCode)}</dd></div>
      <div><dt className="text-muted-foreground">{labels.manager}</dt><dd className="mt-1 font-medium">{value(snapshot.managerName)}</dd></div>
    </dl>
  </div>
}

export function InternalTransferCommitPanel({
  workItemId,
  expectedVersion,
  stepExpectedVersion,
  correlationId,
  labels,
}: {
  readonly workItemId: string
  readonly expectedVersion: number
  readonly stepExpectedVersion: number | null
  readonly correlationId: string | null
  readonly labels: InternalTransferCommitPanelLabels
}) {
  const router = useRouter()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load(): Promise<void> {
      try {
        const response = await fetch(`/api/process-work-items/${workItemId}/internal-transfer-preview`, { cache: 'no-store' })
        const body: unknown = await response.json().catch(() => null)
        const parsed = typeof body === 'object' && body !== null && 'data' in body ? previewSchema.safeParse(body.data) : null
        if (active) {
          setPreview(response.ok && parsed?.success ? parsed.data : null)
          if (!response.ok || !parsed?.success) setFeedback(labels.failed)
        }
      } catch {
        if (active) setFeedback(labels.failed)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [labels.failed, workItemId])

  async function commit(): Promise<void> {
    if (!preview || preview.status === 'BLOCKING') return
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch(`/api/process-work-items/${workItemId}/internal-transfer-commit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedVersion,
          stepExpectedVersion,
          idempotencyKey: crypto.randomUUID(),
          correlationId: correlationId ?? crypto.randomUUID(),
        }),
      })
      if (!response.ok) {
        setFeedback(labels.commitFailed)
        return
      }
      setConfirming(false)
      setFeedback(labels.changed)
      router.refresh()
    } catch {
      setFeedback(labels.commitFailed)
    } finally {
      setBusy(false)
    }
  }

  return <section className="rounded-2xl border border-primary/25 bg-primary/[.03] p-5 sm:p-6" aria-labelledby="internal-transfer-preview-title">
    <p className="eyebrow text-primary">P9</p>
    <h2 className="mt-1 text-xl font-semibold" id="internal-transfer-preview-title">{labels.preview}</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{labels.previewDescription}</p>
    {loading ? <p className="mt-5 text-sm text-muted-foreground" role="status">{labels.loading}</p> : preview ? <>
      <div className={`mt-5 rounded-xl border p-3 text-sm ${preview.status === 'BLOCKING' ? 'border-danger/30 bg-danger-soft text-danger' : preview.status === 'WARNING' ? 'border-warning/30 bg-warning/5 text-warning' : 'border-success/30 bg-success/5 text-success'}`} role="status">
        {preview.status === 'BLOCKING' ? labels.previewBlocking : preview.status === 'WARNING' ? labels.previewWarning : labels.previewSuccess}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Snapshot labels={labels} snapshot={preview.current} title={labels.current} />
        <Snapshot labels={labels} snapshot={preview.proposed} title={labels.proposed} />
      </div>
      {preview.blockers.length > 0 ? <div className="mt-5 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"><h3 className="font-semibold">{labels.blockers}</h3><ul className="mt-2 list-disc space-y-1 pl-5">{preview.blockers.map((item) => <li key={item.code}>{labelForIssue(item.code, labels)}</li>)}</ul></div> : null}
      {preview.warnings.length > 0 ? <div className="mt-5 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-warning"><h3 className="font-semibold">{labels.warnings}</h3><ul className="mt-2 list-disc space-y-1 pl-5">{preview.warnings.map((item) => <li key={item.code}>{labelForIssue(item.code, labels)}</li>)}</ul></div> : null}
      {preview.reason ? <p className="mt-4 text-sm text-muted-foreground">{preview.reason}</p> : null}
      {feedback ? <p aria-live="polite" className="mt-4 text-sm font-medium text-foreground" role="status">{feedback}</p> : null}
      {preview.status !== 'BLOCKING' ? confirming ? <div className="mt-5 rounded-xl border border-border bg-surface p-4"><p className="text-sm font-semibold">{labels.commitConfirm}</p><div className="mt-4 flex flex-wrap justify-end gap-2"><button className="button-secondary" disabled={busy} onClick={() => setConfirming(false)} type="button">{labels.cancel}</button><button className="button-primary" disabled={busy} onClick={() => { void commit() }} type="button">{busy ? labels.committing : labels.commit}</button></div></div> : <button className="button-primary mt-5" disabled={busy} onClick={() => setConfirming(true)} type="button">{labels.commit}</button> : null}
    </> : feedback ? <p aria-live="polite" className="mt-5 text-sm text-danger" role="alert">{feedback}</p> : null}
  </section>
}
