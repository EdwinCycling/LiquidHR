'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import type { DocumentCategory, RelationType } from '@/lib/master-data/catalogs'

export function DocumentCategoryManager({ categories, labels }: { categories: DocumentCategory[]; labels: Record<string, string> }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true)
    const form = new FormData(event.currentTarget)
    await fetch('/api/master-data/document-categories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: form.get('code'), name: form.get('name'), description: form.get('description') }) })
    setSaving(false); event.currentTarget.reset(); router.refresh()
  }
  async function toggle(item: DocumentCategory) { await fetch(`/api/master-data/document-categories/${item.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isActive: !item.is_active }) }); router.refresh() }
  return <div className="space-y-4"><form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1.2fr)_auto]" onSubmit={(event) => void create(event)}><input className="form-field" name="code" placeholder={labels.code} required /><input className="form-field" name="name" placeholder={labels.name} required /><input className="form-field" name="description" placeholder={labels.description} /><button className="button-primary" disabled={saving} type="submit">{saving ? labels.saving : labels.add}</button></form><ul className="grid gap-2">{categories.map((item) => <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" key={item.id}><span><strong>{item.name}</strong><span className="ml-2 text-xs text-muted-foreground">{item.code}</span>{item.description && <span className="mt-1 block text-sm text-muted-foreground">{item.description}</span>}</span><button className="button-secondary" onClick={() => void toggle(item)} type="button">{item.is_active ? labels.deactivate : labels.activate}</button></li>)}</ul></div>
}

export function RelationTypeManager({ relationTypes, labels }: { relationTypes: RelationType[]; labels: Record<string, string> }) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true)
    const form = new FormData(event.currentTarget)
    await fetch('/api/master-data/relation-types', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: form.get('code'), nameNl: form.get('nameNl'), nameEn: form.get('nameEn') }) })
    setSaving(false); event.currentTarget.reset(); router.refresh()
  }
  async function toggle(item: RelationType) { setSavingId(item.id); await fetch('/api/master-data/relation-types', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id, isActive: !item.is_active }) }); setSavingId(null); router.refresh() }
  return <div className="space-y-4"><form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={(event) => void create(event)}><input className="form-field" name="code" placeholder={labels.code} required /><input className="form-field" name="nameNl" placeholder={labels.nameNl} required /><input className="form-field" name="nameEn" placeholder={labels.nameEn} required /><button className="button-primary" disabled={saving} type="submit">{saving ? labels.saving : labels.add}</button></form><ul className="grid gap-2">{relationTypes.map((item) => <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" key={item.id}><span><strong>{item.name_nl}</strong><span className="ml-2 text-xs text-muted-foreground">{item.code}</span><span className="mt-1 block text-sm text-muted-foreground">{item.name_en}</span></span><button className="button-secondary" disabled={savingId === item.id} onClick={() => void toggle(item)} type="button">{item.is_active ? labels.deactivate : labels.activate}</button></li>)}</ul></div>
}
