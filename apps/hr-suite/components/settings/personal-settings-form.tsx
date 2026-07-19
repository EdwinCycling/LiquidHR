'use client'

import { useActionState, useEffect, useState } from 'react'
import { Check, ChevronDown, LoaderCircle } from 'lucide-react'
import { updateUserPreferences, type PreferencesActionState } from '@/app/actions/update-user-preferences'
import { Clock } from '@/components/layout/clock'
import { ANALOG_CLOCK_STYLES, DATE_FORMATS, TIME_FORMATS, UI_THEMES, WEEK_NUMBERING_SYSTEMS, type UserPreferences } from '@/lib/preferences/user-preferences'
import type { SettingsModalLabels } from '@/components/layout/settings-modal'

const initialState: PreferencesActionState = { code: 'idle' }
type OpenSection = 'appearance' | 'formats' | 'timeHub' | null

export function PersonalSettingsForm({ labels, preferences }: { labels: SettingsModalLabels; preferences: UserPreferences }) {
  const [state, action, pending] = useActionState(updateUserPreferences, initialState)
  const [locale, setLocale] = useState(preferences.locale)
  const [theme, setTheme] = useState(preferences.theme)
  const [clockMode, setClockMode] = useState(preferences.clockMode)
  const [analogClockStyle, setAnalogClockStyle] = useState(preferences.analogClockStyle)
  const [dateFormat, setDateFormat] = useState(preferences.dateFormat)
  const [timeFormat, setTimeFormat] = useState(preferences.timeFormat)
  const [weekNumberingSystem, setWeekNumberingSystem] = useState(preferences.weekNumberingSystem)
  const [openSection, setOpenSection] = useState<OpenSection>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = locale
  }, [locale, theme])

  useEffect(() => {
    if (state.code !== 'saved' || !state.preferences) return
    const preferences = state.preferences
    queueMicrotask(() => {
      setLocale(preferences.locale)
      setTheme(preferences.theme)
      setClockMode(preferences.clockMode)
      setAnalogClockStyle(preferences.analogClockStyle)
      setDateFormat(preferences.dateFormat)
      setTimeFormat(preferences.timeFormat)
      setWeekNumberingSystem(preferences.weekNumberingSystem)
    })
  }, [state])

  const feedback = state.code === 'saved' ? labels.saved : state.code === 'invalid' ? labels.invalid
    : state.code === 'unauthenticated' ? labels.unauthenticated : state.code === 'failed' ? labels.saveFailed : null

  return (
    <form action={action} className="space-y-6">
      <input name="locale" type="hidden" value={locale} />
      <input name="theme" type="hidden" value={theme} />
      <input name="dateFormat" type="hidden" value={dateFormat} />
      <input name="timeFormat" type="hidden" value={timeFormat} />
      <input name="weekNumberingSystem" type="hidden" value={weekNumberingSystem} />
      <input name="clockMode" type="hidden" value={clockMode} />
      <input name="analogClockStyle" type="hidden" value={analogClockStyle} />

      <div className="space-y-3">
        <SettingsAccordionSection
          isOpen={openSection === 'appearance'}
          onToggle={() => setOpenSection((current) => current === 'appearance' ? null : 'appearance')}
          subtitle={`${labels.language}: ${locale === 'nl' ? labels.dutch : labels.english} · ${labels.theme}: ${labels.themes[theme].name}`}
          title={labels.appearanceTab}
        >
          <fieldset>
            <legend className="text-sm font-semibold">{labels.language}</legend>
            <p className="mt-1 text-sm text-muted-foreground">{labels.languageHelp}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {([['nl', labels.dutch], ['en', labels.english]] as const).map(([value, label]) => (
                <label className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${locale === value ? 'border-focus bg-accent' : 'bg-surface-raised'}`} key={value}>
                  <input checked={locale === value} className="sr-only" onChange={() => setLocale(value)} type="radio" />
                  {label}{locale === value ? <Check aria-hidden="true" size={17} /> : null}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-7">
            <legend className="text-sm font-semibold">{labels.theme}</legend>
            <p className="mt-1 text-sm text-muted-foreground">{labels.themeHelp}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {UI_THEMES.map((value) => (
                <label className={`cursor-pointer rounded-xl border p-4 ${theme === value ? 'border-focus bg-accent' : 'bg-surface-raised'}`} data-theme={value} key={value}>
                  <input checked={theme === value} className="sr-only" onChange={() => setTheme(value)} type="radio" />
                  <span aria-hidden="true" className="mb-3 flex h-10 overflow-hidden rounded-lg border"><span className="w-1/3 bg-sidebar" /><span className="flex-1 bg-background p-2"><span className="block h-full rounded bg-primary" /></span></span>
                  <span className="block text-sm font-semibold">{labels.themes[value].name}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{labels.themes[value].description}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          isOpen={openSection === 'formats'}
          onToggle={() => setOpenSection((current) => current === 'formats' ? null : 'formats')}
          subtitle={`${labels.dateFormat}: ${dateFormat === 'DMY' ? labels.dmy : dateFormat === 'MDY' ? labels.mdy : labels.ymd} · ${labels.timeFormat}: ${timeFormat === '24H' ? labels.time24 : labels.time12} · ${labels.weekNumbering}: ${weekNumberingSystem === 'ISO' ? labels.weekNumberingIso : labels.weekNumberingInternational}`}
          title={labels.dateFormat}
        >
          <fieldset>
            <legend className="text-sm font-semibold">{labels.dateFormat}</legend>
            <p className="mt-1 text-sm text-muted-foreground">{labels.dateFormatHelp}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {DATE_FORMATS.map((value) => {
                const label = value === 'DMY' ? labels.dmy : value === 'MDY' ? labels.mdy : labels.ymd
                return <label className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-medium ${dateFormat === value ? 'border-focus bg-accent' : 'bg-surface-raised'}`} key={value}><input checked={dateFormat === value} className="sr-only" onChange={() => setDateFormat(value)} type="radio" />{label}</label>
              })}
            </div>
          </fieldset>
          <fieldset className="mt-7">
            <legend className="text-sm font-semibold">{labels.timeFormat}</legend>
            <p className="mt-1 text-sm text-muted-foreground">{labels.timeFormatHelp}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {TIME_FORMATS.map((value) => { const label = value === '24H' ? labels.time24 : labels.time12; return <label className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-medium ${timeFormat === value ? 'border-focus bg-accent' : 'bg-surface-raised'}`} key={value}><input checked={timeFormat === value} className="sr-only" onChange={() => setTimeFormat(value)} type="radio" />{label}</label> })}
            </div>
          </fieldset>
          <fieldset className="mt-7">
            <legend className="text-sm font-semibold">{labels.weekNumbering}</legend>
            <p className="mt-1 text-sm text-muted-foreground">{labels.weekNumberingHelp}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {WEEK_NUMBERING_SYSTEMS.map((value) => {
                const label = value === 'ISO' ? labels.weekNumberingIso : labels.weekNumberingInternational
                return <label className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-medium ${weekNumberingSystem === value ? 'border-focus bg-accent' : 'bg-surface-raised'}`} key={value}><input checked={weekNumberingSystem === value} className="sr-only" onChange={() => setWeekNumberingSystem(value)} type="radio" />{label}</label>
              })}
            </div>
          </fieldset>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          isOpen={openSection === 'timeHub'}
          onToggle={() => setOpenSection((current) => current === 'timeHub' ? null : 'timeHub')}
          subtitle={`${labels.clock}: ${clockMode === 'ANALOG' ? labels.analog : clockMode === 'DIGITAL' ? labels.digital : labels.hidden}${clockMode === 'ANALOG' ? ` · ${labels[analogClockStyle.toLowerCase() as 'classic' | 'minimal' | 'liquid']}` : ''}`}
          title={labels.timeHubTab}
        >
          <fieldset>
            <legend className="text-sm font-semibold">{labels.clock}</legend>
            <p className="mt-1 text-sm text-muted-foreground">{labels.clockHelp}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {([['ANALOG', labels.analog], ['DIGITAL', labels.digital], ['HIDDEN', labels.hidden]] as const).map(([value, label]) => (
                <label className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-medium ${clockMode === value ? 'border-focus bg-accent' : 'bg-surface-raised'}`} key={value}>
                  <input checked={clockMode === value} className="sr-only" onChange={() => setClockMode(value)} type="radio" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {clockMode === 'ANALOG' ? <select className="mt-4 h-10 w-full rounded-lg border bg-surface px-3 text-sm sm:w-72" onChange={(event) => setAnalogClockStyle(event.target.value as typeof analogClockStyle)} value={analogClockStyle}>{ANALOG_CLOCK_STYLES.map((value) => <option key={value} value={value}>{labels[value.toLowerCase() as 'classic' | 'minimal' | 'liquid']}</option>)}</select> : null}
          <div className="mt-5 flex min-h-28 items-center justify-center rounded-xl border bg-sidebar p-4 text-sidebar-foreground"><Clock mode={clockMode} style={analogClockStyle} timeFormat={timeFormat} /></div>
        </SettingsAccordionSection>
      </div>

      {feedback ? <p className={`rounded-xl border px-4 py-3 text-sm ${state.code === 'saved' ? 'border-success/25 bg-success-surface text-success' : 'border-destructive/25 bg-destructive-surface text-destructive'}`} role="status">{feedback}</p> : null}
      <div className="sticky bottom-0 flex justify-end border-t bg-background/95 py-4 backdrop-blur"><button className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">{pending ? <LoaderCircle className="animate-spin" size={17} /> : null}{pending ? labels.saving : labels.save}</button></div>
    </form>
  )
}

function SettingsAccordionSection({
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  subtitle: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-surface shadow-sm">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
        onClick={onToggle}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3 overflow-hidden">
          <span className="shrink-0 text-base font-semibold">{title}</span>
          <span className="truncate text-sm text-muted-foreground">{subtitle}</span>
        </span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen ? <div className="border-t px-5 py-5 sm:px-6">{children}</div> : null}
    </section>
  )
}
