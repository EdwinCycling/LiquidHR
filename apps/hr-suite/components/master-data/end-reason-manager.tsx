'use client'

import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

interface Reason {
  id: string
  code: string
  country_code: string
  name_nl: string
  name_en: string
  is_active: boolean
}

interface Labels {
  country: string
  addCountry: string
  code: string
  nameNl: string
  nameEn: string
  add: string
  edit: string
  save: string
  cancel: string
  active: string
  inactive: string
  activate: string
  deactivate: string
  delete: string
  inUse: string
  failed: string
  emptyCountry: string
  fallbackReason: string
}

const inputClass = 'w-full rounded-xl border bg-background px-3 py-2 text-sm'
const commonCountries = ['NL', 'BE', 'DE', 'FR', 'GB', 'ES', 'PL']

export function EndReasonManager({
  reasons,
  countries,
  countryCode,
  labels,
}: {
  reasons: Reason[]
  countries: string[]
  countryCode: string
  labels: Labels
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<Reason | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const countryOptions = [...new Set([...commonCountries, ...countries, countryCode])].sort()

  async function request(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: object): Promise<boolean> {
    setMessage(null)
    const response = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null
      setMessage(payload?.error === 'END_REASON_IN_USE' ? labels.inUse : labels.failed)
      return false
    }
    router.refresh()
    return true
  }

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    if (await request('/api/master-data/end-reasons', 'POST', {
      countryCode,
      code: form.get('code'),
      nameNl: form.get('nameNl'),
      nameEn: form.get('nameEn'),
    })) formElement.reset()
  }

  async function update(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!editing) return
    const form = new FormData(event.currentTarget)
    if (await request(`/api/master-data/end-reasons/${editing.id}`, 'PATCH', {
      code: form.get('code'),
      nameNl: form.get('nameNl'),
      nameEn: form.get('nameEn'),
    })) setEditing(null)
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-surface p-5">
      <label className="min-w-52 text-sm font-semibold">{labels.country}
        <select className={`mt-1 ${inputClass}`} onChange={(event) => router.push(`/master-data/end-reasons?country=${event.target.value}`)} value={countryCode}>
          {countryOptions.map((country) => <option key={country} value={country}>{country}</option>)}
        </select>
      </label>
      <label className="min-w-52 text-sm font-semibold">{labels.addCountry}
        <input className={`mt-1 ${inputClass} uppercase`} maxLength={2} onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          const value = event.currentTarget.value.trim().toUpperCase()
          if (/^[A-Z]{2}$/.test(value)) router.push(`/master-data/end-reasons?country=${value}`)
        }} />
      </label>
    </div>

    {message ? <p aria-live="polite" className="rounded-xl border bg-surface px-4 py-3 text-sm text-destructive">{message}</p> : null}

    <details className="rounded-2xl border bg-surface p-5">
      <summary className="cursor-pointer font-semibold"><span className="inline-flex items-center gap-2"><Plus size={16} />{labels.add}</span></summary>
      <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={(event) => void create(event)}>
        <label className="text-sm font-semibold">{labels.code}<input className={`mt-1 ${inputClass}`} name="code" required /></label>
        <label className="text-sm font-semibold">{labels.nameNl}<input className={`mt-1 ${inputClass}`} name="nameNl" required /></label>
        <label className="text-sm font-semibold">{labels.nameEn}<input className={`mt-1 ${inputClass}`} name="nameEn" required /></label>
        <div className="flex justify-end gap-2 md:col-span-3"><button className="button-secondary" onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')} type="reset">{labels.cancel}</button><button className="button-primary" type="submit">{labels.add}</button></div>
      </form>
    </details>

    <section className="rounded-2xl border bg-surface p-5">
      {reasons.length === 0 ? <div className="rounded-xl border border-dashed p-5"><p className="font-semibold">{labels.emptyCountry}</p><p className="mt-1 text-sm text-muted-foreground">{labels.fallbackReason}</p></div> : <div className="divide-y">
        {reasons.map((reason) => <article className={`flex flex-wrap items-center gap-3 py-3 ${reason.is_active ? '' : 'opacity-55'}`} key={reason.id}>
          <div className="min-w-0 flex-1"><p className="font-semibold">{reason.code} · {reason.name_nl}</p><p className="text-xs text-muted-foreground">{reason.name_en}</p></div>
          <span className="text-xs">{reason.is_active ? labels.active : labels.inactive}</span>
          <button className="button-secondary" onClick={() => setEditing(reason)} type="button"><Pencil size={15} />{labels.edit}</button>
          <button className="button-secondary" onClick={() => void request(`/api/master-data/end-reasons/${reason.id}`, 'PATCH', { isActive: !reason.is_active })} type="button">{reason.is_active ? labels.deactivate : labels.activate}</button>
          <button aria-label={labels.delete} className="button-secondary text-destructive" onClick={() => void request(`/api/master-data/end-reasons/${reason.id}`, 'DELETE')} type="button"><Trash2 size={15} /></button>
        </article>)}
      </div>}
    </section>

    {editing ? <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/60 p-4" role="presentation" onMouseDown={() => setEditing(null)}>
      <section aria-modal="true" className="w-full max-w-xl rounded-2xl border bg-surface p-6 shadow-2xl" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between"><h2 className="text-xl font-semibold">{labels.edit}</h2><button className="button-secondary" onClick={() => setEditing(null)} type="button"><X size={16} /></button></header>
        <form className="mt-5 grid gap-3" onSubmit={(event) => void update(event)}>
          <label className="text-sm font-semibold">{labels.code}<input className={`mt-1 ${inputClass}`} defaultValue={editing.code} name="code" required /></label>
          <label className="text-sm font-semibold">{labels.nameNl}<input className={`mt-1 ${inputClass}`} defaultValue={editing.name_nl} name="nameNl" required /></label>
          <label className="text-sm font-semibold">{labels.nameEn}<input className={`mt-1 ${inputClass}`} defaultValue={editing.name_en} name="nameEn" required /></label>
          <div className="mt-2 flex justify-end gap-2"><button className="button-secondary" onClick={() => setEditing(null)} type="button">{labels.cancel}</button><button className="button-primary" type="submit">{labels.save}</button></div>
        </form>
      </section>
    </div> : null}
  </div>
}
