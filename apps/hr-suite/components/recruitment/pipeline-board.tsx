'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'
import type { ApplicationCard } from '@/lib/recruitment/application-service'

interface PipelineBoardProps {
  readonly applications: readonly ApplicationCard[]
  readonly labels: { readonly title: string; readonly allStages: string; readonly empty: string; readonly candidate: string; readonly stage: string; readonly source: string; readonly possibleDuplicate: string; readonly move: string; readonly reject: string; readonly reopen: string; readonly hire: string }
}

export function PipelineBoard({ applications, labels }: PipelineBoardProps): ReactElement {
  const router = useRouter()
  const [filter, setFilter] = useState('ALL')
  const [message, setMessage] = useState<string | null>(null)
  const stages = [...new Map(applications.filter((application) => application.stageId && application.stageName).map((application) => [application.stageId as string, application.stageName as string]))]
  const filtered = filter === 'ALL' ? applications : applications.filter((application) => application.stageId === filter)
  async function mutate(application: ApplicationCard, action: 'reject' | 'reopen', stageId?: string): Promise<void> {
    const endpoint = action === 'reject' ? 'reject' : 'reopen'
    const body = action === 'reject' ? { reason: 'Handmatige beoordeling', expectedVersion: application.version, idempotencyKey: crypto.randomUUID() } : { stageId, expectedVersion: application.version, idempotencyKey: crypto.randomUUID() }
    const response = await fetch(`/api/recruitment/applications/${application.id}/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    if (!response?.ok) { setMessage('Actie niet gelukt.'); return }
    setMessage(null); router.refresh()
  }
  return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{labels.title}</h2><label className="text-sm font-medium"><span className="sr-only">{labels.allStages}</span><select className="h-10 rounded-lg border bg-background px-3 text-sm" onChange={(event) => setFilter(event.target.value)} value={filter}><option value="ALL">{labels.allStages}</option>{stages.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div>{message ? <p className="text-sm text-destructive">{message}</p> : null}{filtered.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{labels.empty}</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((application) => <article className="rounded-xl border bg-surface p-5" key={application.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/recruitment/applications/${application.id}`}>{application.candidateName}</Link><p className="mt-1 text-xs text-muted-foreground">{labels.source}: {application.source}</p></div>{application.terminalOutcome ? <span className="rounded-full bg-muted px-2 py-1 text-xs">{application.terminalOutcome}</span> : null}</div><dl className="mt-5 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{labels.stage}</dt><dd>{application.stageName ?? '—'}</dd></div></dl>{application.terminalOutcome === null ? <div className="mt-5 flex flex-wrap gap-2"><label className="sr-only">{labels.move}<select aria-label={labels.move} className="h-9 rounded-lg border bg-background px-2 text-xs" defaultValue={application.stageId ?? ''} onChange={(event) => { if (event.target.value) void fetch(`/api/recruitment/applications/${application.id}/stage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stageId: event.target.value, expectedVersion: application.version, idempotencyKey: crypto.randomUUID() }) }).then(() => router.refresh()) }}><option value="">{labels.move}</option>{stages.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><button className="button-secondary text-destructive" onClick={() => void mutate(application, 'reject')} type="button">{labels.reject}</button><Link className="button-secondary" href={`/recruitment/applications/${application.id}`}>{labels.hire}</Link></div> : <button className="button-secondary mt-5" onClick={() => { const firstStage = stages[0]?.[0]; if (firstStage) void mutate(application, 'reopen', firstStage) }} type="button">{labels.reopen}</button>}</article>)}</div>}</section>
}
