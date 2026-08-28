'use client'

import { useActionState, useEffect, useState } from 'react'
import { Clock } from '@/components/layout/clock'
import { FormActions } from '@/components/patterns/form-actions'
import { FormField } from '@/components/patterns/form-field'
import { SettingsAccordion } from '@/components/settings/settings-accordion'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { RadioGroup } from '@/components/ui/radio-group'
import { Surface } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'
import { updateUserPreferences, type PreferencesActionState } from '@/app/actions/update-user-preferences'
import { ANALOG_CLOCK_STYLES, DATE_FORMATS, TIME_FORMATS, UI_THEMES, WEEK_NUMBERING_SYSTEMS, type UserPreferences } from '@/lib/preferences/user-preferences'
import type { SettingsModalLabels } from '@/components/layout/settings-modal'

const initialState: PreferencesActionState = { code: 'idle' }

export function PersonalSettingsForm({ labels, preferences }: { labels: SettingsModalLabels; preferences: UserPreferences }) {
  const [state, action, pending] = useActionState(updateUserPreferences, initialState)
  const [locale, setLocale] = useState(preferences.locale)
  const [theme, setTheme] = useState(preferences.theme)
  const [useCompanyTheme, setUseCompanyTheme] = useState(preferences.useCompanyTheme)
  const [clockMode, setClockMode] = useState(preferences.clockMode)
  const [analogClockStyle, setAnalogClockStyle] = useState(preferences.analogClockStyle)
  const [dateFormat, setDateFormat] = useState(preferences.dateFormat)
  const [timeFormat, setTimeFormat] = useState(preferences.timeFormat)
  const [weekNumberingSystem, setWeekNumberingSystem] = useState(preferences.weekNumberingSystem)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const root = document.documentElement
    const branding = preferences.companyBranding
    if (useCompanyTheme && branding) {
      root.style.setProperty('--primary', branding.primaryColor)
      root.style.setProperty('--primary-hover', branding.primaryColor)
      root.style.setProperty('--accent', branding.accentColor)
      root.style.setProperty('--accent-foreground', branding.primaryColor)
      root.style.setProperty('--focus', branding.primaryColor)
      root.style.setProperty('--sidebar', branding.sidebarColor)
      root.style.setProperty('--sidebar-accent', branding.primaryColor)
    } else {
      for (const property of ['--primary', '--primary-hover', '--accent', '--accent-foreground', '--focus', '--sidebar', '--sidebar-accent']) root.style.removeProperty(property)
    }
    document.documentElement.lang = locale
  }, [locale, theme, useCompanyTheme, preferences.companyBranding])

  useEffect(() => {
    if (state.code !== 'saved' || !state.preferences) return
    const nextPreferences = state.preferences
    queueMicrotask(() => {
      setLocale(nextPreferences.locale)
      setTheme(nextPreferences.theme)
      setUseCompanyTheme(nextPreferences.useCompanyTheme)
      setClockMode(nextPreferences.clockMode)
      setAnalogClockStyle(nextPreferences.analogClockStyle)
      setDateFormat(nextPreferences.dateFormat)
      setTimeFormat(nextPreferences.timeFormat)
      setWeekNumberingSystem(nextPreferences.weekNumberingSystem)
    })
  }, [state])

  const feedback = state.code === 'saved' ? labels.saved : state.code === 'invalid' ? labels.invalid
    : state.code === 'unauthenticated' ? labels.unauthenticated : state.code === 'failed' ? labels.saveFailed : null
  const reset = (): void => {
    setLocale(preferences.locale)
    setTheme(preferences.theme)
    setUseCompanyTheme(preferences.useCompanyTheme)
    setClockMode(preferences.clockMode)
    setAnalogClockStyle(preferences.analogClockStyle)
    setDateFormat(preferences.dateFormat)
    setTimeFormat(preferences.timeFormat)
    setWeekNumberingSystem(preferences.weekNumberingSystem)
  }

  const languageOptions = [
    { value: 'nl', label: labels.dutch },
    { value: 'en', label: labels.english },
  ] as const
  const themeOptions = UI_THEMES.map((value) => ({
    value,
    label: <ThemeOption value={value} name={labels.themes[value].name} />,
    description: labels.themes[value].description,
  }))
  const dateOptions = DATE_FORMATS.map((value) => ({ value, label: value === 'DMY' ? labels.dmy : value === 'MDY' ? labels.mdy : labels.ymd }))
  const timeOptions = TIME_FORMATS.map((value) => ({ value, label: value === '24H' ? labels.time24 : labels.time12 }))
  const weekOptions = WEEK_NUMBERING_SYSTEMS.map((value) => ({ value, label: value === 'ISO' ? labels.weekNumberingIso : labels.weekNumberingInternational }))
  const clockOptions = [
    { value: 'ANALOG', label: labels.analog },
    { value: 'DIGITAL', label: labels.digital },
    { value: 'HIDDEN', label: labels.hidden },
  ] as const

  return (
    <form action={action} className="space-y-6">
      <input name="locale" type="hidden" value={locale} />
      <input name="theme" type="hidden" value={theme} />
      <input name="useCompanyTheme" type="hidden" value={String(useCompanyTheme)} />
      <input name="dateFormat" type="hidden" value={dateFormat} />
      <input name="timeFormat" type="hidden" value={timeFormat} />
      <input name="weekNumberingSystem" type="hidden" value={weekNumberingSystem} />
      <input name="clockMode" type="hidden" value={clockMode} />
      <input name="analogClockStyle" type="hidden" value={analogClockStyle} />

      <SettingsAccordion initialOpen="appearance" sections={[
        {
          id: 'appearance',
          title: labels.appearanceTab,
          children: <div className="space-y-7">
            <div>
              <p className="text-sm font-semibold text-foreground">{labels.language}</p>
              <p className="mt-1 text-sm text-muted-foreground">{labels.languageHelp}</p>
              <RadioGroup className="mt-3 sm:grid-cols-2" legend={undefined} name="locale" onValueChange={(value) => setLocale(value as typeof locale)} options={languageOptions} value={locale} />
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">{labels.theme}</p>
              <p className="mt-1 text-sm text-muted-foreground">{labels.themeHelp}</p>
              {preferences.companyBranding ? <Surface className="mt-3 p-4" variant="subtle"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex h-10 w-16 shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-border"><span className="w-1/3" style={{ backgroundColor: preferences.companyBranding.sidebarColor }} /><span className="flex-1 bg-background p-1.5"><span className="block h-full rounded-sm" style={{ backgroundColor: preferences.companyBranding.primaryColor }} /></span></span><div className="min-w-0"><p className="text-sm font-semibold">{labels.companyTheme}</p><p className="mt-1 text-xs text-muted-foreground">{labels.companyThemeDescription}</p></div></div><Switch checked={useCompanyTheme} description={undefined} label={labels.companyTheme} onCheckedChange={setUseCompanyTheme} /></div></Surface> : null}
              <RadioGroup className="mt-4 sm:grid-cols-2" legend={undefined} name="theme" onValueChange={(value) => { setTheme(value as typeof theme); setUseCompanyTheme(false) }} options={themeOptions} value={theme} />
            </div>
          </div>,
        },
        {
          id: 'formats',
          title: labels.dateFormat,
          children: <div className="space-y-7">
            <div><p className="text-sm font-semibold text-foreground">{labels.dateFormat}</p><p className="mt-1 text-sm text-muted-foreground">{labels.dateFormatHelp}</p><RadioGroup className="mt-3 sm:grid-cols-3" legend={undefined} name="dateFormat" onValueChange={(value) => setDateFormat(value as typeof dateFormat)} options={dateOptions} value={dateFormat} /></div>
            <div><p className="text-sm font-semibold text-foreground">{labels.timeFormat}</p><p className="mt-1 text-sm text-muted-foreground">{labels.timeFormatHelp}</p><RadioGroup className="mt-3 sm:grid-cols-2" legend={undefined} name="timeFormat" onValueChange={(value) => setTimeFormat(value as typeof timeFormat)} options={timeOptions} value={timeFormat} /></div>
            <div><p className="text-sm font-semibold text-foreground">{labels.weekNumbering}</p><p className="mt-1 text-sm text-muted-foreground">{labels.weekNumberingHelp}</p><RadioGroup className="mt-3 sm:grid-cols-2" legend={undefined} name="weekNumberingSystem" onValueChange={(value) => setWeekNumberingSystem(value as typeof weekNumberingSystem)} options={weekOptions} value={weekNumberingSystem} /></div>
          </div>,
        },
        {
          id: 'timeHub',
          title: labels.timeHubTab,
          children: <div className="space-y-5">
            <div><p className="text-sm font-semibold text-foreground">{labels.clock}</p><p className="mt-1 text-sm text-muted-foreground">{labels.clockHelp}</p><RadioGroup className="mt-3 sm:grid-cols-3" legend={undefined} name="clockMode" onValueChange={(value) => setClockMode(value as typeof clockMode)} options={clockOptions} value={clockMode} /></div>
            {clockMode === 'ANALOG' ? <FormField control={<DropdownSelect name="analogClockStyle" onChange={(event) => setAnalogClockStyle(event.target.value as typeof analogClockStyle)} value={analogClockStyle}>{ANALOG_CLOCK_STYLES.map((value) => <option key={value} value={value}>{labels[value.toLowerCase() as 'classic' | 'minimal' | 'liquid']}</option>)}</DropdownSelect>} label={labels.clockStyle} required /> : null}
            <Surface className="flex min-h-28 items-center justify-center bg-sidebar p-4 text-sidebar-foreground" variant="subtle"><div className="text-center"><span className="mb-3 block text-xs font-semibold text-sidebar-muted">{labels.clockPreview}</span><Clock mode={clockMode} style={analogClockStyle} timeFormat={timeFormat} /></div></Surface>
          </div>,
        },
      ]} />

      {feedback ? <Surface className={`px-4 py-3 text-sm ${state.code === 'saved' ? 'text-success' : 'text-destructive'}`} role={state.code === 'saved' ? 'status' : 'alert'} variant="subtle">{feedback}</Surface> : null}
      <FormActions cancelLabel={labels.cancel} onCancel={reset} saveLabel={labels.save} saving={pending} sticky />
    </form>
  )
}

function ThemeOption({ value, name }: { value: (typeof UI_THEMES)[number]; name: string }) {
  return <span className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex h-8 w-12 shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-border" data-theme={value}><span className="w-1/3 bg-sidebar" /><span className="flex-1 bg-background p-1"><span className="block h-full rounded-sm bg-primary" /></span></span><span className="min-w-0 truncate">{name}</span></span>
}
