'use client'

import { Copy, Edit3, LoaderCircle, Save, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { DashboardView, DashboardWidget, PersonalDashboard } from '@/lib/dashboard/service'
import type { DashboardWidgetType } from '@/lib/dashboard/schemas'
import { DashboardEditor } from './dashboard-editor'
import { DashboardSwitcher } from './dashboard-switcher'
import { moveWidget, normalizeWidgetPositions, removeWidget } from './dashboard-workspace-model'
import { DashboardWidgetRenderer, type DashboardWidgetLabels } from './widget-renderer'

interface DashboardWorkspaceLabels extends DashboardWidgetLabels {
  title: string
  new: string
  edit: string
  save: string
  cancel: string
  addWidget: string
  removeWidget: string
  moveUp: string
  moveDown: string
  rename: string
  duplicate: string
  delete: string
  error: string
  dashboardName: string
  create: string
}

interface DashboardApiResponse { data: { dashboards: PersonalDashboard[]; view: DashboardView } }

function endpoint(id?: string): string { return id ? `/api/dashboards?id=${encodeURIComponent(id)}` : '/api/dashboards' }

export function DashboardWorkspace({ labels }: { labels: DashboardWorkspaceLabels }) {
  const [dashboards, setDashboards] = useState<PersonalDashboard[]>([])
  const [view, setView] = useState<DashboardView | null>(null)
  const [draftWidgets, setDraftWidgets] = useState<DashboardWidget[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameMode, setNameMode] = useState<'create' | 'rename' | null>(null)
  const [name, setName] = useState('')

  const load = useCallback(async (id?: string) => {
    setIsLoading(true); setError(null)
    try {
      const response = await fetch(endpoint(id), { cache: 'no-store' })
      if (!response.ok) throw new Error('DASHBOARD_LOAD_FAILED')
      const payload = await response.json() as DashboardApiResponse
      setDashboards(payload.data.dashboards); setView(payload.data.view); setDraftWidgets(payload.data.view.widgets)
      const nextUrl = id ? `/dashboard?id=${encodeURIComponent(id)}` : '/dashboard'
      window.history.replaceState(null, '', nextUrl)
    } catch { setError(labels.error) } finally { setIsLoading(false) }
  }, [labels.error])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(new URLSearchParams(window.location.search).get('id') ?? undefined) }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  function startEdit() { if (!view) return; setDraftWidgets(view.widgets.map((widget) => ({ ...widget }))); setIsEditing(true) }
  function cancelEdit() { if (view) setDraftWidgets(view.widgets.map((widget) => ({ ...widget }))); setIsEditing(false) }
  function addWidget(type: DashboardWidgetType) { setDraftWidgets((widgets) => normalizeWidgetPositions([...widgets, { id: `draft-${crypto.randomUUID()}`, type, position: widgets.length, settings: {} }])) }

  async function saveLayout() {
    if (!view) return
    setIsSaving(true); setError(null)
    try {
      const response = await fetch(`/api/dashboards/${view.dashboard.id}/layout`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ widgets: normalizeWidgetPositions(draftWidgets).map(({ type, position, settings }) => ({ type, position, settings })) }) })
      if (!response.ok) throw new Error('DASHBOARD_SAVE_FAILED')
      setIsEditing(false); await load(view.dashboard.id)
    } catch { setError(labels.error) } finally { setIsSaving(false) }
  }

  async function submitName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!name.trim()) return
    setIsSaving(true); setError(null)
    try {
      const target = nameMode === 'rename' && view ? `/api/dashboards/${view.dashboard.id}` : '/api/dashboards'
      const response = await fetch(target, { method: nameMode === 'rename' ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })
      if (!response.ok) throw new Error('DASHBOARD_NAME_FAILED')
      const payload = await response.json() as { data: PersonalDashboard }
      setNameMode(null); setName(''); await load(payload.data.id)
    } catch { setError(labels.error) } finally { setIsSaving(false) }
  }

  async function duplicate() { if (!view) return; setIsSaving(true); try { const response = await fetch(`/api/dashboards/${view.dashboard.id}`, { method: 'POST' }); if (!response.ok) throw new Error('DASHBOARD_DUPLICATE_FAILED'); const payload = await response.json() as { data: PersonalDashboard }; await load(payload.data.id) } catch { setError(labels.error) } finally { setIsSaving(false) } }
  async function removeDashboard() { if (!view) return; setIsSaving(true); try { const response = await fetch(`/api/dashboards/${view.dashboard.id}`, { method: 'DELETE' }); if (!response.ok) throw new Error('DASHBOARD_DELETE_FAILED'); await load() } catch { setError(labels.error) } finally { setIsSaving(false) } }

  if (isLoading) return <section aria-busy="true" className="mx-auto max-w-7xl px-4 py-8 sm:px-8"><div className="h-9 w-56 animate-pulse rounded bg-muted" /><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><div className="h-48 animate-pulse rounded-2xl bg-muted" /><div className="h-48 animate-pulse rounded-2xl bg-muted" /><div className="h-48 animate-pulse rounded-2xl bg-muted" /></div></section>
  if (!view || error) return <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8"><div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm font-medium text-destructive">{error ?? labels.error}</div></section>

  const availableTypes = view.availableWidgetTypes.filter((type) => !draftWidgets.some((widget) => widget.type === type))
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-9 lg:px-10">
      <header className="border-b pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">Liquid HR</p>
            <h1 className="mt-2 truncate text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">{view.dashboard.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DashboardSwitcher activeId={view.dashboard.id} dashboards={dashboards} labels={{ title: labels.title, new: labels.new }} onCreate={() => { setNameMode('create'); setName('') }} onSelect={(id) => { setIsEditing(false); void load(id) }} />
            {!isEditing ? <><button className="button-secondary min-h-10 gap-2" onClick={() => { setNameMode('rename'); setName(view.dashboard.name) }} type="button"><Edit3 aria-hidden="true" size={16} />{labels.rename}</button><button aria-label={labels.duplicate} className="grid size-10 place-items-center rounded-lg border bg-surface hover:bg-muted focus-visible:ring-2 focus-visible:ring-focus" disabled={isSaving} onClick={() => void duplicate()} type="button"><Copy aria-hidden="true" size={16} /></button><button aria-label={labels.delete} className="grid size-10 place-items-center rounded-lg border bg-surface text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-focus" disabled={dashboards.length <= 1 || isSaving} onClick={() => void removeDashboard()} type="button"><Trash2 aria-hidden="true" size={16} /></button><button className="button-primary min-h-10 gap-2" onClick={startEdit} type="button"><Edit3 aria-hidden="true" size={16} />{labels.edit}</button></> : <><button className="button-secondary min-h-10 gap-2" disabled={isSaving} onClick={cancelEdit} type="button"><X aria-hidden="true" size={16} />{labels.cancel}</button><button className="button-primary min-h-10 gap-2" disabled={isSaving} onClick={() => void saveLayout()} type="button">{isSaving ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : <Save aria-hidden="true" size={16} />}{labels.save}</button></>}
          </div>
        </div>
        {nameMode ? <form className="mt-5 flex max-w-md flex-wrap gap-2" onSubmit={submitName}><label className="sr-only" htmlFor="dashboard-name">{labels.dashboardName}</label><input autoFocus className="h-10 min-w-0 flex-1 rounded-lg border bg-surface px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus" id="dashboard-name" maxLength={80} onChange={(event) => setName(event.target.value)} placeholder={labels.dashboardName} value={name} /><button className="button-primary min-h-10" disabled={isSaving} type="submit">{nameMode === 'create' ? labels.create : labels.save}</button><button aria-label={labels.cancel} className="grid size-10 place-items-center rounded-lg border bg-surface hover:bg-muted focus-visible:ring-2 focus-visible:ring-focus" onClick={() => setNameMode(null)} type="button"><X aria-hidden="true" size={16} /></button></form> : null}
      </header>
      {isEditing ? <div className="mt-5"><DashboardEditor availableTypes={availableTypes} labels={{ addWidget: labels.addWidget, moveUp: labels.moveUp, moveDown: labels.moveDown, removeWidget: labels.removeWidget }} onAdd={addWidget} onMove={(id, direction) => setDraftWidgets((widgets) => moveWidget(widgets, id, direction))} onRemove={(id) => setDraftWidgets((widgets) => removeWidget(widgets, id))} widgets={draftWidgets} /></div> : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{(isEditing ? draftWidgets : view.widgets).map((widget) => <DashboardWidgetRenderer key={widget.id} labels={labels} metrics={view.metrics} widget={widget} />)}</div>
    </section>
  )
}
