'use client'

import { useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { DocumentStudioAssetRow, DocumentStudioProfileRow } from '@/lib/document-studio/repository'

type AdministrationOption = { readonly id: string; readonly name: string }
type Labels = { readonly title: string; readonly new: string; readonly name: string; readonly administration: string; readonly logo: string; readonly noLogo: string; readonly default: string; readonly status: string; readonly active: string; readonly inactive: string; readonly empty: string; readonly save: string; readonly cancel: string; readonly failed: string }

export function DocumentProfileManager({ initial, administrations, assets, labels }: { initial: readonly DocumentStudioProfileRow[]; administrations: readonly AdministrationOption[]; assets: readonly DocumentStudioAssetRow[]; labels: Labels }) {
  const [items, setItems] = useState([...initial])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DocumentStudioProfileRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  function begin(item?: DocumentStudioProfileRow) {
    setEditing(item ?? null); setError(null); setOpen(true)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = {
      name: String(form.get('name') ?? ''),
      sourceAdministrationId: String(form.get('administrationId') ?? ''),
      logoAssetId: String(form.get('logoAssetId') ?? '') || null,
      isDefault: form.get('isDefault') === 'on',
      isActive: form.get('isActive') === 'on',
    }
    const response = await fetch(editing ? `/api/document-studio/profiles/${editing.id}` : '/api/document-studio/profiles', { method: editing ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) { setError(labels.failed); return }
    const result = await response.json() as { data: DocumentStudioProfileRow }
    setItems((current) => editing ? current.map((item) => item.id === editing.id ? result.data : item) : [result.data, ...current])
    setOpen(false)
  }

  return <>
    <Surface className="overflow-x-auto">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4"><h2 className="font-semibold">{labels.title}</h2><Button onClick={() => begin()} size="sm" type="button">{labels.new}</Button></div>
      {items.length ? <table className="min-w-[52rem] w-full text-left text-sm"><thead className="border-b border-border bg-surface-subtle text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">{labels.name}</th><th className="px-4 py-3">{labels.administration}</th><th className="px-4 py-3">{labels.logo}</th><th className="px-4 py-3">{labels.default}</th><th className="px-4 py-3">{labels.status}</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-border">{items.map((item) => <tr key={item.id}><td className="px-4 py-3">{item.name}</td><td className="px-4 py-3">{administrations.find((administration) => administration.id === item.source_administration_id)?.name ?? item.source_administration_id}</td><td className="px-4 py-3">{assets.find((asset) => asset.id === item.logo_asset_id)?.original_filename ?? labels.noLogo}</td><td className="px-4 py-3">{item.is_default ? labels.default : labels.noLogo}</td><td className="px-4 py-3">{item.is_active ? labels.active : labels.inactive}</td><td className="px-4 py-3 text-right"><Button onClick={() => begin(item)} size="sm" type="button" variant="ghost">{labels.name}</Button></td></tr>)}</tbody></table> : <p className="p-6 text-sm text-muted-foreground">{labels.empty}</p>}
    </Surface>
    <Dialog closeLabel={labels.cancel} onOpenChange={setOpen} open={open} title={editing ? labels.name : labels.new}>
      <form className="space-y-4" onSubmit={submit}>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <label className="block space-y-1 text-sm font-medium">{labels.name}<TextInput defaultValue={editing?.name} name="name" required /></label>
        <label className="block space-y-1 text-sm font-medium">{labels.administration}<DropdownSelect defaultValue={editing?.source_administration_id ?? administrations[0]?.id} name="administrationId" searchable searchPlaceholder={labels.administration}>{administrations.map((administration) => <option key={administration.id} value={administration.id}>{administration.name}</option>)}</DropdownSelect></label>
        <label className="block space-y-1 text-sm font-medium">{labels.logo}<DropdownSelect defaultValue={editing?.logo_asset_id ?? ''} name="logoAssetId" searchable searchPlaceholder={labels.logo}><option value="">{labels.noLogo}</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_filename}</option>)}</DropdownSelect></label>
        <label className="flex items-center gap-2 text-sm font-medium"><input defaultChecked={editing?.is_default} name="isDefault" type="checkbox" />{labels.default}</label>
        <label className="flex items-center gap-2 text-sm font-medium"><input defaultChecked={editing?.is_active ?? true} name="isActive" type="checkbox" />{labels.status}</label>
        <Button type="submit">{labels.save}</Button>
      </form>
    </Dialog>
  </>
}
