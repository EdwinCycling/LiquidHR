'use client'

import { useMemo, useState } from 'react'
import type { TalentTeamMatrix } from '@/lib/talent/team-service'

type Labels = {
  title: string
  subtitle: string
  search: string
  searchPlaceholder: string
  type: string
  status: string
  source: string
  all: string
  noResults: string
  empty: string
  employee: string
  job: string
  capabilities: string
  noCapabilities: string
  draft: string
  released: string
  expired: string
  self: string
  hr: string
  manager: string
  imported: string
  scope: string
  aggregateDisabled: string
}

export function TalentTeamMatrix({ initial, labels }: { initial: TalentTeamMatrix; labels: Labels }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('nl-NL')
  const types = [...new Set(initial.rows.flatMap((row) => row.capabilities.map((capability) => capability.capabilityType)))].sort()
  const visible = useMemo(() => initial.rows.filter((row) => {
    const employeeMatch = !normalizedQuery || [row.employeeLabel, row.employeeNumber, row.jobTitle ?? '', ...row.capabilities.flatMap((capability) => [capability.capabilityName, capability.capabilityCode])].some((value) => value.toLocaleLowerCase('nl-NL').includes(normalizedQuery))
    const capabilityMatch = row.capabilities.some((capability) => (!type || capability.capabilityType === type) && (!status || capability.status === status) && (!source || capability.source_type === source))
    return employeeMatch && (type || status || source ? capabilityMatch : true)
  }), [initial.rows, normalizedQuery, source, status, type])

  return <section className="mt-6 space-y-5">
    <header className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{labels.scope}: {initial.scopeCount}</span></div><p className="mt-3 text-xs text-muted-foreground">{labels.aggregateDisabled}</p></header>
    <div className="rounded-2xl border bg-surface p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-4"><label className="text-sm md:col-span-2"><span className="sr-only">{labels.search}</span><input aria-label={labels.search} className="form-field" placeholder={labels.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="text-sm"><span className="sr-only">{labels.type}</span><select aria-label={labels.type} className="form-field" value={type} onChange={(event) => setType(event.target.value)}><option value="">{labels.type}: {labels.all}</option>{types.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-sm"><span className="sr-only">{labels.status}</span><select aria-label={labels.status} className="form-field" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{labels.status}: {labels.all}</option><option value="DRAFT">{labels.draft}</option><option value="RELEASED">{labels.released}</option><option value="EXPIRED">{labels.expired}</option></select></label></div><div className="mt-3 grid gap-3 md:grid-cols-4"><label className="text-sm"><span className="sr-only">{labels.source}</span><select aria-label={labels.source} className="form-field" value={source} onChange={(event) => setSource(event.target.value)}><option value="">{labels.source}: {labels.all}</option><option value="SELF_ENTERED">{labels.self}</option><option value="HR_ENTERED">{labels.hr}</option><option value="MANAGER_ENTERED">{labels.manager}</option><option value="IMPORTED">{labels.imported}</option></select></label></div></div>
    {initial.rows.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{labels.empty}</p> : visible.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{labels.noResults}</p> : <div className="grid gap-4 md:grid-cols-2">{visible.map((row) => <article className="rounded-2xl border bg-surface p-5 shadow-sm" key={row.employeeId}><header className="flex flex-wrap items-start justify-between gap-3 border-b pb-3"><div><h3 className="font-semibold">{row.employeeLabel}</h3><p className="mt-1 text-xs text-muted-foreground">{labels.employee}: {row.employeeNumber} · {labels.job}: {row.jobTitle ?? '-'}</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{row.capabilities.length}</span></header><div className="mt-4 space-y-2">{row.capabilities.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noCapabilities}</p> : row.capabilities.map((capability) => <div className="rounded-xl border bg-background p-3" key={capability.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold">{capability.capabilityName}</p><p className="mt-1 text-xs text-muted-foreground">{capability.capabilityCode} · {capability.capabilityType}</p></div><span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium">{capability.status}</span></div><p className="mt-2 text-xs text-muted-foreground">{labels.source}: {capability.source_type} · {capability.valid_from}{capability.valid_until ? ` – ${capability.valid_until}` : ''}</p></div>)}</div></article>)}</div>}
  </section>
}
