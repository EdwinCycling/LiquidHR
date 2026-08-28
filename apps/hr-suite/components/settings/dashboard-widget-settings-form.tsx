'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Surface } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'

type Role = { id: string; code: string; name: string }
type Widget = { type: string; category: string; title: string; description: string; visualizationLabel: string; isEnabled: boolean; roleIds: string[] }
type Labels = { saving: string; saved: string; failed: string; enabled: string; active: string; inactive: string; roles: string; allRoles: string; noRoles: string; categories: Record<string, string> }

export function DashboardWidgetSettingsForm({ widgets, roles, labels }: { widgets: Widget[]; roles: Role[]; labels: Labels }) {
  const [items, setItems] = useState(widgets)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  async function update(widget: Widget, next: Partial<Widget>) {
    const changed = { ...widget, ...next }
    setItems((current) => current.map((item) => item.type === widget.type ? changed : item))
    setSaving(widget.type); setSaved(null); setFailed(null)
    try {
      const response = await fetch('/api/settings/dashboard-widgets', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ widgetType: changed.type, isEnabled: changed.isEnabled, roleIds: changed.roleIds }) })
      if (!response.ok) throw new Error('DASHBOARD_WIDGET_SAVE_FAILED')
      setSaved(widget.type)
    } catch {
      setItems((current) => current.map((item) => item.type === widget.type ? widget : item))
      setFailed(widget.type)
    } finally { setSaving(null) }
  }
  const grouped = items.reduce<Record<string, Widget[]>>((result, item) => { (result[item.category] ??= []).push(item); return result }, {})
  return <div className="space-y-8">{Object.entries(grouped).map(([category, categoryWidgets]) => <section key={category}><h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{labels.categories[category]}</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{categoryWidgets.map((widget) => { const active = widget.isEnabled; return <Surface className={`flex min-h-72 flex-col p-5 ${active ? 'border-primary/40' : 'opacity-75'}`} key={widget.type}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone={active ? 'success' : 'neutral'}>{active ? labels.active : labels.inactive}</Badge><Badge tone="neutral">{widget.visualizationLabel}</Badge></div><h3 className="text-lg font-semibold">{widget.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{widget.description}</p></div><Switch aria-label={labels.enabled} checked={active} disabled={saving === widget.type} onCheckedChange={(checked) => void update(widget, { isEnabled: checked })} /></div><div className="mt-auto border-t border-border-subtle pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.roles}</p>{widget.roleIds.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">{labels.allRoles}</p> : null}<div className="mt-2 flex flex-wrap gap-2">{roles.map((role) => { const checked = widget.roleIds.includes(role.id); return <label className="inline-flex min-w-0 items-center gap-1.5 rounded-[var(--radius-control)] border border-border px-2.5 py-1 text-xs has-[:checked]:border-primary/40 has-[:checked]:bg-accent has-[:checked]:text-accent-foreground" key={role.id}><Checkbox aria-label={role.name} checked={checked} disabled={!active || saving === widget.type} onChange={(event) => void update(widget, { roleIds: event.target.checked ? [...widget.roleIds, role.id] : widget.roleIds.filter((id) => id !== role.id) })} />{role.name}</label> })}</div>{roles.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{labels.noRoles}</p> : null}<div className="mt-3 min-h-5 text-xs" role={failed === widget.type ? 'alert' : 'status'}>{saving === widget.type ? <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />{labels.saving}</span> : saved === widget.type ? <span className="text-success">{labels.saved}</span> : failed === widget.type ? <span className="text-destructive">{labels.failed}</span> : null}</div></div></Surface> })}</div></section>)}</div>
}
