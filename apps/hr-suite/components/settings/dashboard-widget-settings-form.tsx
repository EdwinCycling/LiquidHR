'use client'

import { useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'

type Role = { id: string; code: string; name: string }
type Widget = { type: string; category: string; titleKey: string; descriptionKey: string; isEnabled: boolean; roleIds: string[] }
type Labels = { save: string; saving: string; saved: string; failed: string; enabled: string; roles: string; noRoles: string; categories: Record<string, string>; names: Record<string, string>; descriptions: Record<string, string> }

export function DashboardWidgetSettingsForm({ widgets, roles, labels }: { widgets: Widget[]; roles: Role[]; labels: Labels }) {
  const [items, setItems] = useState(widgets)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  async function update(widget: Widget, next: Partial<Widget>) {
    const changed = { ...widget, ...next }
    setItems((current) => current.map((item) => item.type === widget.type ? changed : item))
    setSaving(widget.type); setSaved(null); setFailed(null)
    const response = await fetch('/api/settings/dashboard-widgets', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ widgetType: changed.type, isEnabled: changed.isEnabled, roleIds: changed.roleIds }) })
    setSaving(null); if (response.ok) setSaved(widget.type); else setFailed(widget.type)
  }
  const grouped = items.reduce<Record<string, Widget[]>>((result, item) => { (result[item.category] ??= []).push(item); return result }, {})
  return <div className="space-y-8">{Object.entries(grouped).map(([category, categoryWidgets]) => <section key={category}><h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{labels.categories[category] ?? category}</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{categoryWidgets.map((widget) => { const active = widget.isEnabled; return <article className={`flex min-h-64 flex-col rounded-2xl border bg-surface p-5 shadow-sm ${active ? 'border-primary/40' : 'opacity-70'}`} key={widget.type}><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold">{labels.names[widget.type] ?? widget.type}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{labels.descriptions[widget.type] ?? widget.descriptionKey}</p></div><button aria-label={labels.enabled} aria-pressed={active} className={`relative h-7 w-12 shrink-0 rounded-full transition ${active ? 'bg-primary' : 'bg-muted-foreground/30'}`} onClick={() => update(widget, { isEnabled: !active })} type="button"><span className={`absolute top-1 grid size-5 place-items-center rounded-full bg-white transition ${active ? 'left-6' : 'left-1'}`}>{active ? <Check className="text-primary" size={12} strokeWidth={3} /> : null}</span></button></div><div className="mt-auto border-t pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.roles}</p><div className="mt-2 flex flex-wrap gap-2">{roles.map((role) => { const checked = widget.roleIds.includes(role.id); return <label className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs" key={role.id}><input checked={checked} disabled={!active || saving === widget.type} onChange={(event) => update(widget, { roleIds: event.target.checked ? [...widget.roleIds, role.id] : widget.roleIds.filter((id) => id !== role.id) })} type="checkbox" />{role.name}</label> })}</div>{roles.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{labels.noRoles}</p> : null}<div className="mt-3 flex items-center gap-2 text-xs">{saving === widget.type ? <><LoaderCircle className="animate-spin" size={14} />{labels.saving}</> : saved === widget.type ? <span className="text-success">{labels.saved}</span> : failed === widget.type ? <span className="text-destructive">{labels.failed}</span> : null}</div></div></article>})}</div></section>)}</div>
}
