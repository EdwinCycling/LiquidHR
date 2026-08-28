'use client'
/* eslint-disable @next/next/no-img-element -- administration branding is served by an authenticated route. */

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import type { CompanyBranding } from '@/lib/preferences/user-preferences'
import { Button, buttonClasses } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { SettingsAccordion } from './settings-accordion'

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
    <SettingsAccordion initialOpen="branding" sections={[{ id: 'branding', title: <span className="min-w-0"><span className="block font-semibold">{labels.title}</span><span className="mt-1 block truncate text-sm text-muted-foreground">{labels.subtitle}</span></span>, children: <div className="px-5 py-6 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <h2 className="font-semibold">{labels.colorsTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.colorsHelp}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {([
                ['primaryColor', labels.primaryColor, primaryColor, setPrimaryColor],
                ['accentColor', labels.accentColor, accentColor, setAccentColor],
                ['sidebarColor', labels.sidebarColor, sidebarColor, setSidebarColor],
              ] as const).map(([key, label, value, setter]) => <div className="grid gap-2 text-sm font-semibold" key={key}><label htmlFor={key}>{label}</label><div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-border bg-background p-2"><input aria-label={label} className="size-10 cursor-pointer rounded-[var(--radius-control)] border-0 bg-transparent p-0" id={key} onChange={(event) => setter(event.target.value)} type="color" value={value} /><TextInput aria-label={label} className="min-w-0 font-mono text-xs" maxLength={7} onChange={(event) => setter(event.target.value)} pattern="#[0-9a-fA-F]{6}" value={value} /></div></div>)}
            </div>
          </div>
          <div className="rounded-[var(--radius-surface)] border border-sidebar-border bg-sidebar p-5 text-sidebar-foreground">
            <h2 className="font-semibold">{labels.logoTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-sidebar-muted">{labels.logoHelp}</p>
            <div className="mt-5 flex min-h-20 items-center justify-center rounded-[var(--radius-control)] border border-sidebar-border bg-sidebar-accent p-4">
              {logoPreviewUrl ? <img alt="" className="max-h-12 max-w-full object-contain" src={logoPreviewUrl} /> : logoUrl && !removeLogo ? <img alt="" className="max-h-12 max-w-full object-contain" src={logoUrl} /> : <span className="text-sm font-semibold text-sidebar-muted">LH</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <label className={`${buttonClasses({ size: 'sm', variant: 'secondary' })} cursor-pointer bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent`}><span>{labels.upload}</span><input accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0] ?? null; setLogo(file); setLogoPreviewUrl(null); setRemoveLogo(false); event.currentTarget.value = '' }} type="file" /></label>
              {(logoUrl || logo) ? <Button className="bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => { setLogo(null); setLogoPreviewUrl(null); setRemoveLogo(true) }} size="sm" type="button" variant="secondary"><Trash2 aria-hidden="true" />{labels.removeLogo}</Button> : null}
            </div>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5">
          <p className={`text-sm ${state === 'failed' ? 'text-destructive' : state === 'saved' ? 'text-success' : 'text-muted-foreground'}`} role={state === 'failed' ? 'alert' : 'status'}>{state === 'failed' ? labels.failed : state === 'saved' ? <><Check className="mr-1 inline" size={16} />{labels.saved}</> : ''}</p>
          <Button loading={state === 'saving'} onClick={() => void save()} type="button">{labels.save}</Button>
        </div>
      </div> }]} />
  )
}
