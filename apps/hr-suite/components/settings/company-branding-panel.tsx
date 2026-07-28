'use client'
/* eslint-disable @next/next/no-img-element -- administration branding is served by an authenticated route. */

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Check, ChevronDown, LoaderCircle, Trash2 } from 'lucide-react'
import type { CompanyBranding } from '@/lib/preferences/user-preferences'

interface CompanyBrandingLabels {
  title: string
  subtitle: string
  colorsTitle: string
  colorsHelp: string
  primaryColor: string
  accentColor: string
  sidebarColor: string
  logoTitle: string
  logoHelp: string
  upload: string
  removeLogo: string
  save: string
  saving: string
  saved: string
  failed: string
  invalid: string
}

export function CompanyBrandingPanel({ initialBranding, labels }: { initialBranding: CompanyBranding | null; labels: CompanyBrandingLabels }) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [primaryColor, setPrimaryColor] = useState(initialBranding?.primaryColor ?? '#2f5bff')
  const [accentColor, setAccentColor] = useState(initialBranding?.accentColor ?? '#e8edff')
  const [sidebarColor, setSidebarColor] = useState(initialBranding?.sidebarColor ?? '#14264a')
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState(initialBranding?.logoUrl ?? null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  useEffect(() => {
    if (!logo) {
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogoPreviewUrl(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(logo)
    return () => reader.abort()
  }, [logo])

  async function save(): Promise<void> {
    setState('saving')
    const formData = new FormData()
    formData.set('primaryColor', primaryColor)
    formData.set('accentColor', accentColor)
    formData.set('sidebarColor', sidebarColor)
    formData.set('removeLogo', String(removeLogo))
    if (logo) formData.set('logo', logo)
    const response = await fetch('/api/settings/company-branding', { method: 'POST', body: formData })
    if (!response.ok) {
      setState('failed')
      return
    }
    const result = await response.json() as { branding: CompanyBranding }
    setLogoUrl(result.branding.logoUrl)
    setLogo(null)
    setLogoPreviewUrl(null)
    setRemoveLogo(false)
    setState('saved')
    router.refresh()
  }

  return (
    <section className="rounded-2xl border bg-surface shadow-sm">
      <button aria-expanded={open} className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left sm:px-6" onClick={() => setOpen((value) => !value)} type="button">
        <span className="min-w-0"><span className="block font-semibold">{labels.title}</span><span className="mt-1 block truncate text-sm text-muted-foreground">{labels.subtitle}</span></span>
        <ChevronDown aria-hidden="true" className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} size={18} />
      </button>
      {open ? <div className="border-t px-5 py-6 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <h2 className="font-semibold">{labels.colorsTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.colorsHelp}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {([
                ['primaryColor', labels.primaryColor, primaryColor, setPrimaryColor],
                ['accentColor', labels.accentColor, accentColor, setAccentColor],
                ['sidebarColor', labels.sidebarColor, sidebarColor, setSidebarColor],
              ] as const).map(([key, label, value, setter]) => <label className="grid gap-2 text-sm font-semibold" key={key} htmlFor={key}><span>{label}</span><span className="flex items-center gap-2 rounded-xl border bg-background p-2"><input aria-label={label} className="size-10 cursor-pointer rounded-lg border-0 bg-transparent p-0" id={key} onChange={(event) => setter(event.target.value)} type="color" value={value} /><input aria-label={label} className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none" maxLength={7} onChange={(event) => setter(event.target.value)} pattern="#[0-9a-fA-F]{6}" value={value} /></span></label>)}
            </div>
          </div>
          <div className="rounded-2xl border bg-sidebar p-5 text-sidebar-foreground">
            <h2 className="font-semibold">{labels.logoTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-sidebar-muted">{labels.logoHelp}</p>
            <div className="mt-5 flex min-h-20 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent p-4">
              {logoPreviewUrl ? <img alt="" className="max-h-12 max-w-full object-contain" src={logoPreviewUrl} /> : logoUrl && !removeLogo ? <img alt="" className="max-h-12 max-w-full object-contain" src={logoUrl} /> : <span className="text-sm font-semibold text-sidebar-muted">LH</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <label className="button-secondary cursor-pointer bg-sidebar text-sidebar-foreground"><span>{labels.upload}</span><input accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0] ?? null; setLogo(file); setLogoPreviewUrl(null); setRemoveLogo(false); event.currentTarget.value = '' }} type="file" /></label>
              {(logoUrl || logo) ? <button className="button-secondary cursor-pointer bg-sidebar text-sidebar-foreground" onClick={() => { setLogo(null); setLogoPreviewUrl(null); setRemoveLogo(true) }} type="button"><Trash2 aria-hidden="true" size={15} />{labels.removeLogo}</button> : null}
            </div>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <p className={`text-sm ${state === 'failed' ? 'text-destructive' : state === 'saved' ? 'text-success' : 'text-muted-foreground'}`} role={state === 'failed' ? 'alert' : 'status'}>{state === 'failed' ? labels.failed : state === 'saved' ? <><Check className="mr-1 inline" size={16} />{labels.saved}</> : ''}</p>
          <button className="button-primary cursor-pointer" disabled={state === 'saving'} onClick={() => void save()} type="button">{state === 'saving' ? <><LoaderCircle className="mr-2 animate-spin" size={16} />{labels.saving}</> : labels.save}</button>
        </div>
      </div> : null}
    </section>
  )
}
