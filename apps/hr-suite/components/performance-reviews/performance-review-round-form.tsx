'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Users } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import nlMessages from '@/messages/nl/performanceReviews.json'
import enMessages from '@/messages/en/performanceReviews.json'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { FilterBar } from '@/components/patterns/filter-bar'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Checkbox } from '@/components/ui/checkbox'

type AssignmentStatus = 'READY' | 'REVIEWER_REQUIRED' | 'ADMINISTRATION_REQUIRED' | 'INVALID'
type Employee = { id: string; first_name: string; birth_name: string; employee_number: string; reviewerName?: string | null; administrationName?: string | null; administrationId?: string | null; reviewerEmployeeId?: string | null; additionalReviewerEmployeeId?: string | null; assignmentStatus?: AssignmentStatus; eligibilityMessage?: string }
type EmployeePage = { items?: Employee[]; nextCursor?: string | null; total?: number }
type FacetOption = { id: string; label: string }
type EmployeeFacets = { hrGroups?: FacetOption[]; administrations?: FacetOption[]; departments?: FacetOption[]; jobs?: FacetOption[]; locations?: FacetOption[]; managers?: FacetOption[]; employmentStatuses?: FacetOption[] }
type Filters = { hrGroupId: string; administrationId: string; departmentId: string; jobId: string; locationId: string; managerId: string; employmentStatus: string }

export function PerformanceReviewRoundForm({ locale }: { locale: Locale }) {
  const messages = locale === 'nl' ? nlMessages : enMessages
  const [title, setTitle] = useState('')
  const [roundType, setRoundType] = useState('development')
  const [introduction, setIntroduction] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [withRating, setWithRating] = useState(false)
  const [additionalReviewerEnabled, setAdditionalReviewerEnabled] = useState(false)
  const [scale, setScale] = useState(5)
  const [ratingLabels, setRatingLabels] = useState<Record<number, string>>({})
  const [ratingDescriptions, setRatingDescriptions] = useState<Record<number, string>>({})
  const [search, setSearch] = useState('')
  const [facets, setFacets] = useState<EmployeeFacets>({})
  const [filters, setFilters] = useState<Filters>({ hrGroupId: '', administrationId: '', departmentId: '', jobId: '', locationId: '', managerId: '', employmentStatus: '' })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected] = useState<Map<string, Employee>>(new Map())
  const [roleCandidates, setRoleCandidates] = useState<Map<string, Employee[]>>(new Map())
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [employeeTotal, setEmployeeTotal] = useState(0)
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [busy, setBusy] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [savedDraft, setSavedDraft] = useState<{ id: string; version: number } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [wizardStep, setWizardStep] = useState(1)

  useEffect(() => {
    let active = true
    void fetch('/api/performance-reviews/employees/filters')
      .then((response) => response.ok ? response.json() as Promise<EmployeeFacets> : Promise.reject(new Error('filters')))
      .then((result) => { if (active) { setFacets(result); if (result.hrGroups?.length === 1) setFilters((current) => ({ ...current, hrGroupId: current.hrGroupId || result.hrGroups?.[0]?.id || '' })) } })
      .catch(() => { if (active) setFacets({}) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoadingEmployees(true)
      void fetch(employeeSearchUrl(search, filters))
        .then((response) => response.ok ? response.json() as Promise<EmployeePage> : Promise.reject(new Error('search')))
        .then((result) => { if (active) { setEmployees(result.items ?? []); setNextCursor(result.nextCursor ?? null); setEmployeeTotal(result.total ?? (result.items ?? []).length) } })
        .catch(() => { if (active) { setEmployees([]); setNextCursor(null); setEmployeeTotal(0) } })
        .finally(() => { if (active) setLoadingEmployees(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [search, filters])

  useEffect(() => {
    let active = true
    const pending = [...selected.values()].filter((employee) => employee.administrationId && !roleCandidates.has(employee.id))
    for (const employee of pending) {
      const url = `/api/performance-reviews/employees/${encodeURIComponent(employee.id)}/role-candidates?administrationId=${encodeURIComponent(employee.administrationId ?? '')}`
      void fetch(url).then((response) => response.ok ? response.json() as Promise<Employee[]> : []).then((items) => {
        if (!active) return
        setRoleCandidates((current) => {
          const next = new Map(current)
          next.set(employee.id, Array.isArray(items) ? items : [])
          return next
        })
      }).catch(() => {
        if (!active) return
        setRoleCandidates((current) => new Map(current).set(employee.id, []))
      })
    }
    return () => { active = false }
  }, [selected, roleCandidates])

  async function loadMore() {
    if (!nextCursor || loadingEmployees) return
    setLoadingEmployees(true)
    try {
      const response = await fetch(employeeSearchUrl(search, filters, nextCursor))
      if (!response.ok) throw new Error('search')
      const result = await response.json() as EmployeePage
      setEmployees((current) => [...current, ...(result.items ?? [])])
      setNextCursor(result.nextCursor ?? null)
      setEmployeeTotal(result.total ?? employeeTotal)
    } catch { setMessage(messages.searchFailed) } finally { setLoadingEmployees(false) }
  }

  function toggle(employee: Employee) {
    setSelected((current) => {
      const next = new Map(current)
      if (next.has(employee.id)) next.delete(employee.id)
      else next.set(employee.id, { ...employee, reviewerEmployeeId: employee.reviewerEmployeeId ?? null, additionalReviewerEmployeeId: null })
      return next
    })
  }

  function setParticipantRole(employeeId: string, role: 'reviewerEmployeeId' | 'additionalReviewerEmployeeId', value: string | null) {
    setSelected((current) => {
      const next = new Map(current)
      const employee = next.get(employeeId)
      if (employee) next.set(employeeId, { ...employee, [role]: value })
      return next
    })
  }

  function setAdditionalReviewerOption(enabled: boolean) {
    setAdditionalReviewerEnabled(enabled)
    if (!enabled) setSelected((current) => new Map([...current].map(([id, employee]) => [id, { ...employee, additionalReviewerEmployeeId: null }])))
  }

  async function save(action: 'save-draft' | 'publish') {
    setMessage(null)
    if (periodStart && periodEnd && periodStart > periodEnd) { setMessage(messages.periodInvalid); return }
    if (dueDate && startDate && dueDate < startDate) { setMessage(messages.dueDateBeforeStart); return }
    if (withRating && !ratingComplete) { setMessage(messages.ratingDetailsRequired); return }
    if (action === 'publish' && selected.size === 0) { setMessage(messages.participantRequired); return }
    const invalidAssignments = [...selected.values()].filter((employee) => additionalReviewerEnabled
      ? !employee.reviewerEmployeeId || !employee.administrationId || employee.additionalReviewerEmployeeId === employee.reviewerEmployeeId
      : employee.assignmentStatus !== 'READY' || !employee.reviewerEmployeeId || !employee.administrationId)
    if (action === 'publish' && invalidAssignments.length) { setMessage(messages.assignmentInvalid); return }
    setBusy(true)
    try {
      const requestKey = idempotencyKey || crypto.randomUUID()
      setIdempotencyKey(requestKey)
      const length = scale
      const rating = withRating ? { options: Array.from({ length }, (_, index) => ({ score: index + 1, label: ratingLabels[index + 1]?.trim() || `${messages.level} ${index + 1}`, description: ratingDescriptions[index + 1]?.trim() || `${messages.level} ${index + 1}` })) } : null
      const roundInput = { title, roundType, introduction, periodStart, periodEnd, startDate, dueDate: dueDate || null, rating, additionalReviewerEnabled }
      if (savedDraft) {
        const response = await fetch(`/api/performance-reviews/rounds/${savedDraft.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ version: savedDraft.version, ...roundInput }),
        })
        if (!response.ok) throw new Error('request')
        const updatedDraft = await response.json() as { id: string; version: number }
        setSavedDraft(updatedDraft)
        if (action === 'publish') {
          for (const employee of selected.values()) {
            const participantResponse = await fetch(`/api/performance-reviews/rounds/${updatedDraft.id}/dossiers`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'Idempotency-Key': `${requestKey}:dossier:${employee.id}` },
              body: JSON.stringify({ employeeId: employee.id, reviewerEmployeeId: employee.reviewerEmployeeId, additionalReviewerEmployeeId: employee.additionalReviewerEmployeeId, administrationId: employee.administrationId }),
            })
            if (!participantResponse.ok) throw new Error('participant')
          }
          const publishResponse = await fetch(`/api/performance-reviews/rounds/${updatedDraft.id}/publish`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'Idempotency-Key': `${requestKey}:publish` },
            body: JSON.stringify({ version: updatedDraft.version }),
          })
          if (!publishResponse.ok) throw new Error('publish')
          setSavedDraft(null)
        }
      } else {
        const response = await fetch('/api/performance-reviews', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'Idempotency-Key': requestKey },
          body: JSON.stringify({ action, ...roundInput, participants: [...selected.values()].map(({ id, reviewerEmployeeId, additionalReviewerEmployeeId, administrationId }) => ({ employeeId: id, reviewerEmployeeId, additionalReviewerEmployeeId, administrationId })) }),
        })
        if (!response.ok) throw new Error('request')
        if (action === 'save-draft') {
          const createdDraft = await response.json() as { id?: string; version?: number }
          if (!createdDraft.id || typeof createdDraft.version !== 'number') throw new Error('draft')
          setSavedDraft({ id: createdDraft.id, version: createdDraft.version })
        }
      }
      setIdempotencyKey('')
      setMessage(action === 'publish' ? messages.roundPublished : messages.draftSaved)
    } catch { setMessage(messages.saveFailed) } finally { setBusy(false) }
  }

  const ratingScores = Array.from({ length: scale }, (_, index) => index + 1)
  const ratingComplete = ratingScores.every((score) => ratingLabels[score]?.trim() && ratingDescriptions[score]?.trim())
  const hasAmbiguousAssignment = [...selected.values()].some((employee) => additionalReviewerEnabled
    ? !employee.reviewerEmployeeId || !employee.administrationId || employee.additionalReviewerEmployeeId === employee.reviewerEmployeeId
    : employee.assignmentStatus !== 'READY' || !employee.reviewerEmployeeId || !employee.administrationId)
  const readyVisible = employees.filter((employee) => additionalReviewerEnabled
    ? Boolean(employee.administrationId)
    : employee.assignmentStatus === 'READY')
  const allVisibleSelected = readyVisible.length > 0 && readyVisible.every((employee) => selected.has(employee.id))
  const steps = [messages.roundConfiguration, messages.participants, messages.reviewAndPublish]

  function advanceStep() {
    setMessage(null)
    if (wizardStep === 1) {
      if (!title.trim() || !introduction.trim() || !periodStart || !periodEnd || !startDate) { setMessage(messages.requiredFields); return }
      if (periodStart > periodEnd) { setMessage(messages.periodInvalid); return }
      if (dueDate && dueDate < startDate) { setMessage(messages.dueDateBeforeStart); return }
      if (withRating && !ratingComplete) { setMessage(messages.ratingDetailsRequired); return }
    }
    if (wizardStep === 2 && selected.size === 0) { setMessage(messages.participantRequired); return }
    if (wizardStep === 2 && hasAmbiguousAssignment) { setMessage(messages.assignmentInvalid); return }
    setWizardStep((step) => Math.min(3, step + 1))
  }
  function toggleVisible() {
    setSelected((current) => {
      const next = new Map(current)
      if (allVisibleSelected) readyVisible.forEach((employee) => next.delete(employee.id))
      else readyVisible.forEach((employee) => next.set(employee.id, { ...employee, reviewerEmployeeId: employee.reviewerEmployeeId ?? null, additionalReviewerEmployeeId: null }))
      return next
    })
  }

  return <PageShell className="space-y-6 py-6 sm:py-8" width="wide">
    <PageHeader title={messages.newRound} description={messages.roundWizardIntro} />
    <nav aria-label={messages.roundWizardIntro}>
      <ol className="grid grid-cols-3 gap-2">
        {steps.map((label, index) => <li key={label}>
          <button aria-current={wizardStep === index + 1 ? 'step' : undefined} className={`flex min-h-12 w-full items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-left text-sm ${wizardStep === index + 1 ? 'border-primary bg-surface-raised font-semibold' : 'border-border bg-surface text-muted-foreground'}`} onClick={() => setWizardStep(index + 1)} type="button">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-current text-xs">{index + 1}</span><span className="min-w-0 break-words">{label}</span>
          </button>
        </li>)}
      </ol>
    </nav>
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void save('save-draft') }}>
      <div className="space-y-5">
        {wizardStep === 1 ? <><Surface className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">{messages.roundAndPeriod}</h2>
          <TextField label={messages.titleLabel} value={title} onChange={setTitle} required />
          <label className="block text-sm font-medium">{messages.roundType}<select className="mt-1 block w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2" value={roundType} onChange={(event) => setRoundType(event.target.value)}><option value="functioning">{messages.roundTypeFunctioning}</option><option value="assessment">{messages.roundTypeAssessment}</option><option value="development">{messages.roundTypeDevelopment}</option><option value="lookback">{messages.roundTypeLookback}</option><option value="lookahead">{messages.roundTypeLookahead}</option><option value="interim">{messages.roundTypeInterim}</option><option value="custom">{messages.roundTypeCustom}</option></select></label>
          <label className="block text-sm font-medium">{messages.introduction}<textarea required className="mt-1 min-h-28 block w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2" value={introduction} onChange={(event) => setIntroduction(event.target.value)} /></label>
          <div className="grid gap-4 sm:grid-cols-2"><DateField label={messages.periodFrom} value={periodStart} onChange={setPeriodStart} /><DateField label={messages.periodTo} value={periodEnd} onChange={setPeriodEnd} /><DateField label={messages.startDate} value={startDate} onChange={setStartDate} /><DateField label={messages.dueDate} value={dueDate} onChange={setDueDate} required={false} /></div>
          <p className="flex gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4 shrink-0" />{messages.softDeadline}</p>
          <div className="space-y-1"><label className="flex items-center gap-3 text-sm"><Checkbox checked={additionalReviewerEnabled} onChange={(event) => setAdditionalReviewerOption(event.target.checked)} />{messages.additionalReviewerEnabled}</label><p className="pl-7 text-xs text-muted-foreground">{messages.additionalReviewerOptional}</p></div>
        </Surface><Surface className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">{messages.rating}</h2>
          <label className="flex items-center gap-3 text-sm"><Checkbox checked={withRating} onChange={(event) => setWithRating(event.target.checked)} />{messages.includeRating}</label>
          {withRating ? <><label className="block text-sm font-medium">{messages.scale}<select className="mt-1 block rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2" value={scale} onChange={(event) => setScale(Number(event.target.value))}><option value={4}>4</option><option value={5}>5</option><option value={10}>10</option></select></label><div className="space-y-3">{ratingScores.map((score) => <fieldset className="grid gap-3 rounded-[var(--radius-control)] border border-border-subtle p-3 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)]" key={score}><legend className="sr-only">{messages.score} {score}</legend><span className="self-center text-sm font-semibold">{score}</span><TextField label={messages.ratingLabel} value={ratingLabels[score] ?? ''} onChange={(value) => setRatingLabels((current) => ({ ...current, [score]: value }))} required={false} /><TextField label={messages.ratingDescription} value={ratingDescriptions[score] ?? ''} onChange={(value) => setRatingDescriptions((current) => ({ ...current, [score]: value }))} required={false} /></fieldset>)}</div></> : null}
        </Surface></> : null}
      </div>
      {wizardStep === 2 ? <aside className="space-y-4">
        <Surface className="space-y-4 p-5">
          <div><h2 className="text-lg font-semibold">{messages.participants}</h2><p className="mt-1 text-sm text-muted-foreground">{messages.participantPreview}</p></div>
          <TextField label={messages.searchEmployee} value={search} onChange={setSearch} required={false} />
          <FilterBar className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Facet label={messages.filterHrGroup} allLabel={messages.allHrGroups} options={facets.hrGroups ?? []} value={filters.hrGroupId} onChange={(hrGroupId) => setFilters((current) => ({ ...current, hrGroupId }))} />
            <Facet label={messages.filterAdministration} allLabel={messages.allAdministrations} options={facets.administrations ?? []} value={filters.administrationId} onChange={(administrationId) => setFilters((current) => ({ ...current, administrationId }))} />
            <Facet label={messages.filterDepartment} allLabel={messages.allDepartments} options={facets.departments ?? []} value={filters.departmentId} onChange={(departmentId) => setFilters((current) => ({ ...current, departmentId }))} />
            <Facet label={messages.filterJob} allLabel={messages.allJobs} options={facets.jobs ?? []} value={filters.jobId} onChange={(jobId) => setFilters((current) => ({ ...current, jobId }))} />
            <Facet label={messages.filterLocation} allLabel={messages.allLocations} options={facets.locations ?? []} value={filters.locationId} onChange={(locationId) => setFilters((current) => ({ ...current, locationId }))} />
            <Facet label={messages.filterManager} allLabel={messages.allManagers} options={facets.managers ?? []} value={filters.managerId} onChange={(managerId) => setFilters((current) => ({ ...current, managerId }))} />
            <Facet label={messages.filterEmploymentStatus} allLabel={messages.allEmploymentStatuses} options={facets.employmentStatuses ?? []} value={filters.employmentStatus} onChange={(employmentStatus) => setFilters((current) => ({ ...current, employmentStatus }))} />
          </FilterBar>
          <div aria-live="polite" className="max-h-64 divide-y divide-border-subtle overflow-auto rounded-[var(--radius-control)] border border-border-subtle">
            {employees.map((employee) => <label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm" key={employee.id}><Checkbox checked={selected.has(employee.id)} disabled={!employee.administrationId || (!additionalReviewerEnabled && employee.assignmentStatus !== 'READY')} onChange={() => toggle(employee)} /><span className="min-w-0"><span className="block break-words">{[employee.first_name, employee.birth_name].filter(Boolean).join(' ')} <span className="text-xs text-muted-foreground">({employee.employee_number})</span></span>{employee.assignmentStatus === 'READY' ? <span className="mt-1 block text-xs text-muted-foreground">{employee.reviewerName ?? messages.managerAssigned}{employee.administrationName ? ` · ${employee.administrationName}` : ''}</span> : <span className="mt-1 block text-xs text-destructive">{additionalReviewerEnabled ? employee.administrationName ?? messages.administrationRequired : employee.eligibilityMessage ?? (employee.assignmentStatus === 'REVIEWER_REQUIRED' ? messages.reviewerRequired : employee.assignmentStatus === 'ADMINISTRATION_REQUIRED' ? messages.administrationRequired : messages.assignmentInvalid)}</span>}</span></label>)}
            {!employees.length && !loadingEmployees ? <p className="p-3 text-sm text-muted-foreground">{messages.noEmployeesFound}</p> : null}
            {loadingEmployees ? <p className="p-3 text-sm text-muted-foreground" role="status">{messages.loadingEmployees}</p> : null}
          </div>
          {employees.length ? <Button className="w-full" onClick={toggleVisible} type="button" variant="secondary">{allVisibleSelected ? messages.clearVisible : messages.selectVisible}</Button> : null}
          {nextCursor ? <Button className="w-full" disabled={loadingEmployees} onClick={() => void loadMore()} type="button" variant="secondary">{messages.loadMore}</Button> : null}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Users className="size-4" /><span>{selected.size} {messages.selected}</span><span aria-hidden="true">·</span><span>{readyVisible.length} {messages.eligibleVisible}</span><span aria-hidden="true">·</span><span>{employeeTotal} {messages.matches}</span></div>
          {selected.size ? <ul className="max-h-[34rem] divide-y divide-border-subtle overflow-auto rounded-[var(--radius-control)] border border-border-subtle">{[...selected.values()].map((employee) => {
            const candidates = roleCandidates.get(employee.id) ?? []
            return <li className="grid gap-3 px-3 py-3 text-sm" key={employee.id}>
              <div className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block break-words font-medium">{[employee.first_name, employee.birth_name].filter(Boolean).join(' ')}</span>{employee.administrationName ? <span className="block text-xs text-muted-foreground">{employee.administrationName}</span> : null}</span><button className="shrink-0 text-xs underline underline-offset-4" onClick={() => toggle(employee)} type="button">{messages.remove}</button></div>
              <label className="block text-xs font-medium">{messages.conversationLead}<DropdownSelect aria-label={`${messages.conversationLead}: ${employee.first_name}`} className="mt-1 text-sm" searchable searchPlaceholder={messages.roleCandidates} value={employee.reviewerEmployeeId ?? ''} onChange={(event) => setParticipantRole(employee.id, 'reviewerEmployeeId', event.target.value || null)}><option value="">{messages.reviewerRequired}</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{[candidate.first_name, candidate.birth_name].filter(Boolean).join(' ')} ({candidate.employee_number})</option>)}</DropdownSelect></label>
              {additionalReviewerEnabled ? <label className="block text-xs font-medium">{messages.additionalReviewer}<DropdownSelect aria-label={`${messages.additionalReviewer}: ${employee.first_name}`} className="mt-1 text-sm" searchable searchPlaceholder={messages.roleCandidates} value={employee.additionalReviewerEmployeeId ?? ''} onChange={(event) => setParticipantRole(employee.id, 'additionalReviewerEmployeeId', event.target.value || null)}><option value="">{messages.flipBlocked}</option>{candidates.filter((candidate) => candidate.id !== employee.reviewerEmployeeId).map((candidate) => <option key={candidate.id} value={candidate.id}>{[candidate.first_name, candidate.birth_name].filter(Boolean).join(' ')} ({candidate.employee_number})</option>)}</DropdownSelect></label> : null}
            </li>
          })}</ul> : null}
          {hasAmbiguousAssignment ? <p className="text-sm text-destructive" role="alert">{messages.assignmentInvalid}</p> : null}
        </Surface>
        <Surface className="space-y-3 p-5" variant="subtle"><p className="flex gap-2 text-sm"><CheckCircle2 className="size-4 shrink-0" />{messages.oneDossier}</p></Surface>
      </aside> : null}
      {wizardStep === 3 ? <section aria-labelledby="performance-review-confirm-title" className="space-y-5">
        <Surface className="space-y-4 p-5">
          <h2 className="text-lg font-semibold" id="performance-review-confirm-title">{messages.reviewAndPublish}</h2>
          <p className="text-sm text-muted-foreground">{messages.reviewBeforePublish}</p>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground">{messages.titleLabel}</dt><dd className="mt-1 break-words font-medium">{title}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{messages.roundType}</dt><dd className="mt-1 break-words font-medium">{roundType}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{messages.periodFrom} – {messages.periodTo}</dt><dd className="mt-1 font-medium">{periodStart} – {periodEnd}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{messages.startDate}</dt><dd className="mt-1 font-medium">{startDate}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{messages.dueDate}</dt><dd className="mt-1 font-medium">{dueDate || '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{messages.rating}</dt><dd className="mt-1 font-medium">{withRating ? `${scale} ${messages.scale}` : messages.noRating}</dd></div>
          </dl>
        </Surface>
        <Surface className="space-y-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold">{messages.participants}</h3><span className="text-sm text-muted-foreground">{selected.size} {messages.selected}</span></div>
          <ul className="divide-y divide-border-subtle rounded-[var(--radius-control)] border border-border-subtle">
            {[...selected.values()].map((employee) => <li className="grid gap-1 px-3 py-3 text-sm sm:grid-cols-3" key={employee.id}><span className="break-words font-medium">{[employee.first_name, employee.birth_name].filter(Boolean).join(' ')}</span><span className="text-muted-foreground">{roleCandidates.get(employee.id)?.find((candidate) => candidate.id === employee.reviewerEmployeeId)?.first_name ?? employee.reviewerName ?? messages.reviewerRequired}</span><span className="text-muted-foreground">{additionalReviewerEnabled ? roleCandidates.get(employee.id)?.find((candidate) => candidate.id === employee.additionalReviewerEmployeeId)?.first_name ?? messages.additionalReviewerOptional : employee.administrationName ?? messages.administrationRequired}</span></li>)}
          </ul>
        </Surface>
      </section> : null}
      {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {wizardStep > 1 ? <Button onClick={() => setWizardStep((step) => step - 1)} type="button" variant="secondary">{messages.previousStep}</Button> : null}
          {wizardStep < 3 ? <Button disabled={busy} onClick={advanceStep} type="button">{messages.nextStep}</Button> : null}
          {wizardStep === 1 ? <Button disabled={busy || !title.trim() || !introduction.trim() || (withRating && !ratingComplete)} type="submit" variant="secondary">{messages.saveDraft}</Button> : null}
          {wizardStep === 3 ? <Button disabled={busy || !title.trim() || !introduction.trim() || !startDate || selected.size === 0 || hasAmbiguousAssignment || (withRating && !ratingComplete)} onClick={(event) => { event.preventDefault(); void save('publish') }} type="button">{messages.publish}</Button> : null}
        </div>
      </div>
    </form>
  </PageShell>
}

function TextField({ label, value, onChange, required = true }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <label className="block text-sm font-medium">{label}<input required={required} className="mt-1 block w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function DateField({ label, value, onChange, required = true }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <label className="block text-sm font-medium">{label}<input required={required} type="date" className="mt-1 block w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function employeeSearchUrl(search: string, filters: Filters, cursor?: string | null) {
  const params = new URLSearchParams({ search })
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  if (cursor) params.set('cursor', cursor)
  return `/api/performance-reviews/employees?${params.toString()}`
}
function Facet({ label, allLabel, options, value, onChange }: { label: string; allLabel: string; options: FacetOption[]; value: string; onChange: (value: string) => void }) {
  return <label className="min-w-0 text-xs font-medium">{label}<DropdownSelect aria-label={label} className="mt-1 text-sm" searchable searchPlaceholder={label} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{allLabel}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</DropdownSelect></label>
}
