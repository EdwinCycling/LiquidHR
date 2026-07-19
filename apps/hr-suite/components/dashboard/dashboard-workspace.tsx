'use client'

import { Copy, Edit3, LoaderCircle, Save, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { DashboardView, DashboardWidget, PersonalDashboard } from '@/lib/dashboard/service'
import type { DashboardWidgetPresentation } from '@/lib/dashboard/widget-presentation'
import { DashboardEditor } from './dashboard-editor'
import { DashboardProgressProvider, DashboardRefreshButton } from './dashboard-progress'
import { DashboardSwitcher } from './dashboard-switcher'
import { addWidgetToDraft, moveWidget, normalizeWidgetPositions, removeWidget } from './dashboard-workspace-model'
import type { DashboardWidgetLabels } from './widget-renderer'

export interface DashboardWorkspaceLabels extends DashboardWidgetLabels {
  title: string; new: string; edit: string; save: string; cancel: string; addWidget: string; removeWidget: string
  moveUp: string; moveDown: string; rename: string; duplicate: string; delete: string; error: string
  dashboardName: string; create: string; refresh: string; loadedProgress: string; updated: string; loadedWithErrors: string
  pickerTitle: string; pickerDescription: string; pickerSearch: string; pickerAll: string; pickerAdd: string
  pickerAlreadyAdded: string; pickerEmpty: string; pickerDone: string; close: string
}

export interface DashboardWorkspaceData { dashboards: PersonalDashboard[]; view: DashboardView }

export function DashboardWorkspace({ children, data, generation, labels, locale, presentations }: { children: React.ReactNode; data: DashboardWorkspaceData; generation: string; labels: DashboardWorkspaceLabels; locale: string; presentations: DashboardWidgetPresentation[] }) {
  return <DashboardProgressProvider generation={generation} labels={{ loadedProgress: labels.loadedProgress, updated: labels.updated, loadedWithErrors: labels.loadedWithErrors, refresh: labels.refresh }} total={data.view.widgets.length}><DashboardWorkspaceContent data={data} labels={labels} locale={locale} presentations={presentations}>{children}</DashboardWorkspaceContent></DashboardProgressProvider>
}

function DashboardWorkspaceContent({ children, data, labels, locale, presentations }: { children: React.ReactNode; data: DashboardWorkspaceData; labels: DashboardWorkspaceLabels; locale: string; presentations: DashboardWidgetPresentation[] }) {
  const router = useRouter()
  const { dashboards, view } = data
  const [draftWidgets, setDraftWidgets] = useState<DashboardWidget[]>(view.widgets)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameMode, setNameMode] = useState<'create' | 'rename' | null>(null)
  const [name, setName] = useState('')

  const navigate = (id?: string) => router.push(id ? `/dashboard?id=${encodeURIComponent(id)}` : '/dashboard')
  function startEdit() { setDraftWidgets(view.widgets.map((widget) => ({ ...widget }))); setIsEditing(true) }
  function cancelEdit() { setDraftWidgets(view.widgets.map((widget) => ({ ...widget }))); setIsEditing(false) }
  function addWidget(presentation: DashboardWidgetPresentation) { setDraftWidgets((widgets) => addWidgetToDraft(widgets, presentation)) }

  async function saveLayout() {
    setIsSaving(true); setError(null)
    try {
      const response = await fetch(`/api/dashboards/${view.dashboard.id}/layout`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ widgets: normalizeWidgetPositions(draftWidgets).map(({ type, position, settings }) => ({ type, position, settings })) }) })
      if (!response.ok) throw new Error('DASHBOARD_SAVE_FAILED')
      setIsEditing(false); router.refresh()
    } catch { setError(labels.error) } finally { setIsSaving(false) }
  }

  async function submitName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!name.trim()) return
    setIsSaving(true); setError(null)
    try {
      const target = nameMode === 'rename' ? `/api/dashboards/${view.dashboard.id}` : '/api/dashboards'
      const response = await fetch(target, { method: nameMode === 'rename' ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })
      if (!response.ok) throw new Error('DASHBOARD_NAME_FAILED')
      const payload = await response.json() as { data: PersonalDashboard }
      setNameMode(null); setName(''); navigate(payload.data.id)
    } catch { setError(labels.error) } finally { setIsSaving(false) }
  }

  async function duplicate() { setIsSaving(true); try { const response = await fetch(`/api/dashboards/${view.dashboard.id}`, { method: 'POST' }); if (!response.ok) throw new Error('DASHBOARD_DUPLICATE_FAILED'); const payload = await response.json() as { data: PersonalDashboard }; navigate(payload.data.id) } catch { setError(labels.error) } finally { setIsSaving(false) } }
  async function removeDashboard() { setIsSaving(true); try { const response = await fetch(`/api/dashboards/${view.dashboard.id}`, { method: 'DELETE' }); if (!response.ok) throw new Error('DASHBOARD_DELETE_FAILED'); navigate() } catch { setError(labels.error) } finally { setIsSaving(false) } }

  const availablePresentations = presentations.filter((item) => view.availableWidgetTypes.includes(item.type))
  return <section className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-9 lg:px-10">
    <header className="border-b pb-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">Liquid HR</p><h1 className="mt-2 truncate text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">{view.dashboard.name}</h1></div><div className="flex flex-wrap items-center gap-2">
      <DashboardSwitcher activeId={view.dashboard.id} dashboards={dashboards} labels={{ title: labels.title, new: labels.new }} onCreate={() => { setNameMode('create'); setName('') }} onSelect={(id) => { setIsEditing(false); navigate(id) }} />
      {!isEditing ? <><DashboardRefreshButton label={labels.refresh} /><button className="button-secondary min-h-10 gap-2" onClick={() => { setNameMode('rename'); setName(view.dashboard.name) }} type="button"><Edit3 aria-hidden="true" size={16} />{labels.rename}</button><button aria-label={labels.duplicate} className="grid size-10 place-items-center rounded-lg border bg-surface hover:bg-muted focus-visible:ring-2 focus-visible:ring-focus" disabled={isSaving} onClick={() => void duplicate()} type="button"><Copy aria-hidden="true" size={16} /></button><button aria-label={labels.delete} className="grid size-10 place-items-center rounded-lg border bg-surface text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-focus" disabled={dashboards.length <= 1 || isSaving} onClick={() => void removeDashboard()} type="button"><Trash2 aria-hidden="true" size={16} /></button><button className="button-primary min-h-10 gap-2" onClick={startEdit} type="button"><Edit3 aria-hidden="true" size={16} />{labels.edit}</button></> : <><button className="button-secondary min-h-10 gap-2" disabled={isSaving} onClick={cancelEdit} type="button"><X aria-hidden="true" size={16} />{labels.cancel}</button><button className="button-primary min-h-10 gap-2" disabled={isSaving} onClick={() => void saveLayout()} type="button">{isSaving ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : <Save aria-hidden="true" size={16} />}{labels.save}</button></>}
    </div></div>{nameMode ? <form className="mt-5 flex max-w-md flex-wrap gap-2" onSubmit={submitName}><label className="sr-only" htmlFor="dashboard-name">{labels.dashboardName}</label><input autoFocus className="h-10 min-w-0 flex-1 rounded-lg border bg-surface px-3 text-sm" id="dashboard-name" maxLength={80} onChange={(event) => setName(event.target.value)} placeholder={labels.dashboardName} value={name} /><button className="button-primary min-h-10" disabled={isSaving} type="submit">{nameMode === 'create' ? labels.create : labels.save}</button><button aria-label={labels.cancel} className="grid size-10 place-items-center rounded-lg border bg-surface" onClick={() => setNameMode(null)} type="button"><X aria-hidden="true" size={16} /></button></form> : null}</header>
    {error ? <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-medium text-destructive">{error}</p> : null}
    {isEditing ? <div className="mt-5"><DashboardEditor labels={{ addWidget: labels.addWidget, moveUp: labels.moveUp, moveDown: labels.moveDown, removeWidget: labels.removeWidget, title: labels.pickerTitle, description: labels.pickerDescription, search: labels.pickerSearch, all: labels.pickerAll, add: labels.pickerAdd, alreadyAdded: labels.pickerAlreadyAdded, empty: labels.pickerEmpty, done: labels.pickerDone, close: labels.close }} locale={locale} onAdd={addWidget} onMove={(id, direction) => setDraftWidgets((widgets) => moveWidget(widgets, id, direction))} onRemove={(id) => setDraftWidgets((widgets) => removeWidget(widgets, id))} presentations={availablePresentations} widgets={draftWidgets} /></div> : <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{children}</div>}
  </section>
}
