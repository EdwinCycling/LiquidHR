'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'

interface PublicationPanelProps {
  readonly vacancyId: string
  readonly vacancyTitle: string
  readonly sections: readonly { readonly title: string; readonly content: string; readonly isVisible: boolean }[]
  readonly publication: { readonly id: string; readonly slug: string; readonly status: 'OPEN' | 'CLOSED' | 'ARCHIVED'; readonly payload: Record<string, unknown> } | null
  readonly labels: { readonly title: string; readonly publish: string; readonly close: string; readonly archive: string; readonly formTitle: string; readonly phone: string; readonly cv: string; readonly motivation: string; readonly hidden: string; readonly optional: string; readonly required: string; readonly save: string; readonly slug: string; readonly publicLink: string; readonly error: string }
}

export function PublicationPanel({ vacancyId, vacancyTitle, sections, publication, labels }: PublicationPanelProps): ReactElement {
  const router = useRouter()
  const [state, setState] = useState<'IDLE' | 'SAVING' | 'ERROR'>('IDLE')
  const [slug, setSlug] = useState(publication?.slug ?? vacancyTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  const initialConfig = typeof publication?.payload.formConfig === 'object' && publication.payload.formConfig !== null ? publication.payload.formConfig as Record<string, unknown> : {}
  const [phone, setPhone] = useState(typeof initialConfig.phone === 'string' ? initialConfig.phone : 'OPTIONAL')
  const [cv, setCv] = useState(typeof initialConfig.cv === 'string' ? initialConfig.cv : 'OPTIONAL')
  const [motivation, setMotivation] = useState(typeof initialConfig.motivation === 'string' ? initialConfig.motivation : 'OPTIONAL')
  const choices = [[labels.hidden, 'HIDDEN'], [labels.optional, 'OPTIONAL'], [labels.required, 'REQUIRED']] as const

  async function update(status: 'OPEN' | 'CLOSED' | 'ARCHIVED'): Promise<void> {
    setState('SAVING')
    const response = await fetch(`/api/recruitment/vacancies/${vacancyId}/publication`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, slug, payload: { companyName: 'LiquidHR', sections, formConfig: { phone, cv, motivation } } }) }).catch(() => null)
    if (!response?.ok) { setState('ERROR'); return }
    setState('IDLE'); router.refresh()
  }
  const isOpen = publication?.status === 'OPEN'
  const saveStatus = publication?.status === 'OPEN' ? 'OPEN' : 'CLOSED'
  return <section className="rounded-xl border bg-surface p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{labels.title}</p><p className="mt-2 text-sm text-muted-foreground">{publication?.status ?? 'DRAFT'}</p></div><div className="flex flex-wrap gap-2">{isOpen ? <button className="button-secondary" disabled={state === 'SAVING'} onClick={() => void update('CLOSED')} type="button">{labels.close}</button> : <button className="button-primary" disabled={state === 'SAVING'} onClick={() => void update('OPEN')} type="button">{labels.publish}</button>}{publication && publication.status !== 'ARCHIVED' ? <button className="button-secondary" disabled={state === 'SAVING'} onClick={() => void update('ARCHIVED')} type="button">{labels.archive}</button> : null}</div></div><label className="mt-5 block text-sm font-medium">{labels.slug}<input className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" onChange={(event) => setSlug(event.target.value)} value={slug} /></label><div className="mt-6 border-t pt-5"><p className="font-semibold">{labels.formTitle}</p><div className="mt-4 grid gap-4 sm:grid-cols-3">{([[labels.phone, phone, setPhone], [labels.cv, cv, setCv], [labels.motivation, motivation, setMotivation]] as const).map(([label, value, setter]) => <label className="text-sm font-medium" key={label}>{label}<select className="mt-2 h-10 w-full rounded-lg border bg-background px-2 text-sm" onChange={(event) => setter(event.target.value)} value={value}>{choices.map(([choiceLabel, choiceValue]) => <option key={choiceValue} value={choiceValue}>{choiceLabel}</option>)}</select></label>)}</div><button className="button-secondary mt-4" disabled={state === 'SAVING'} onClick={() => void update(saveStatus)} type="button">{labels.save}</button></div>{publication?.status === 'OPEN' ? <Link className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`/vacancies/${publication.id}/${publication.slug}`} target="_blank">{labels.publicLink}</Link> : null}{state === 'ERROR' ? <p className="mt-3 text-sm text-destructive">{labels.error}</p> : null}</section>
}
