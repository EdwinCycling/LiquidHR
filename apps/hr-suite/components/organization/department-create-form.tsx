'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Option { id: string; name: string }
interface Labels { title: string; code: string; name: string; parent: string; noParent: string; create: string; saved: string; failed: string }
export function DepartmentCreateForm({ departments, labels }: { departments: Option[]; labels: Labels }) {
  const router = useRouter(); const [message, setMessage] = useState<string | null>(null)
  async function submit(formData: FormData): Promise<void> { setMessage(null); try { const response = await fetch('/api/departments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: formData.get('code'), name: formData.get('name'), parentId: formData.get('parentId') || null }) }); if (!response.ok) throw new Error('FAILED'); setMessage(labels.saved); router.refresh() } catch { setMessage(labels.failed) } }
  return <form action={submit} className="mb-7 grid gap-3 rounded-2xl border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-[1fr_2fr_2fr_auto]"><h2 className="sm:col-span-2 lg:col-span-4 font-semibold text-foreground">{labels.title}</h2><label className="text-sm">{labels.code}<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="code" required /></label><label className="text-sm">{labels.name}<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="name" required /></label><label className="text-sm">{labels.parent}<select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="parentId"><option value="">{labels.noParent}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><button className="self-end rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" type="submit">{labels.create}</button>{message ? <p aria-live="polite" className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">{message}</p> : null}</form>
}
