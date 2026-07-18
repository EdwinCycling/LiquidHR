'use client'

import { useActionState, useEffect, useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import { updateUserPreferences, type PreferencesActionState } from '@/app/actions/update-user-preferences'
import { Clock } from '@/components/layout/clock'
import { ANALOG_CLOCK_STYLES, DATE_FORMATS, TIME_FORMATS, UI_THEMES, type UserPreferences } from '@/lib/preferences/user-preferences'
import type { SettingsModalLabels } from '@/components/layout/settings-modal'

const initialState: PreferencesActionState = { code: 'idle' }

export function PersonalSettingsForm({ labels, preferences }: { labels: SettingsModalLabels; preferences: UserPreferences }) {
  const [state, action, pending] = useActionState(updateUserPreferences, initialState)
  const [locale, setLocale] = useState(preferences.locale)
  const [theme, setTheme] = useState(preferences.theme)
  const [clockMode, setClockMode] = useState(preferences.clockMode)
  const [analogClockStyle, setAnalogClockStyle] = useState(preferences.analogClockStyle)
  const [dateFormat, setDateFormat] = useState(preferences.dateFormat)
  const [timeFormat, setTimeFormat] = useState(preferences.timeFormat)

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
    })
  }, [state])

  const feedback = state.code === 'saved' ? labels.saved : state.code === 'invalid' ? labels.invalid
    : state.code === 'unauthenticated' ? labels.unauthenticated : state.code === 'failed' ? labels.saveFailed : null

  return (
    <form action={action} className="space-y-6">
      <section className="rounded-2xl border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{labels.appearanceTab}</h2>
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">{labels.language}</legend>
          <p className="mt-1 text-sm text-muted-foreground">{labels.languageHelp}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([['nl', labels.dutch], ['en', labels.english]] as const).map(([value, label]) => (
              <label className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${locale === value ? 'border-focus bg-accent' : 'bg-surface-raised'}`} key={value}>
                <input checked={locale === value} className="sr-only" name="locale" onChange={() => setLocale(value)} type="radio" value={value} />
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
                <input checked={theme === value} className="sr-only" name="theme" onChange={() => setTheme(value)} type="radio" value={value} />
                <span aria-hidden="true" className="mb-3 flex h-10 overflow-hidden rounded-lg border"><span className="w-1/3 bg-sidebar" /><span className="flex-1 bg-background p-2"><span className="block h-full rounded bg-primary" /></span></span>
                <span className="block text-sm font-semibold">{labels.themes[value].name}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{labels.themes[value].description}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="rounded-2xl border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{labels.dateFormat}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{labels.dateFormatHelp}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {DATE_FORMATS.map((value) => {
            const label = value === 'DMY' ? labels.dmy : value === 'MDY' ? labels.mdy : labels.ymd
            return <label className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-medium ${dateFormat === value ? 'border-focus bg-accent' : 'bg-surface-raised'}`} key={value}><input checked={dateFormat === value} className="sr-only" name="dateFormat" onChange={() => setDateFormat(value)} type="radio" value={value} />{label}</label>
          })}
        </div>
        <h2 className="mt-7 text-lg font-semibold">{labels.timeFormat}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{labels.timeFormatHelp}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {TIME_FORMATS.map((value) => { const label = value === '24H' ? labels.time24 : labels.time12; return <label className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-medium ${timeFormat === value ? 'border-focus bg-accent' : 'bg-surface-raised'}`} key={value}><input checked={timeFormat === value} className="sr-only" name="timeFormat" onChange={() => setTimeFormat(value)} type="radio" value={value} />{label}</label> })}
        </div>
      </section>

      <section className="rounded-2xl border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{labels.timeHubTab}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{labels.clockHelp}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {([['ANALOG', labels.analog], ['DIGITAL', labels.digital], ['HIDDEN', labels.hidden]] as const).map(([value, label]) => (
            <label className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-medium ${clockMode === value ? 'border-focus bg-accent' : 'bg-surface-raised'}`} key={value}>
              <input checked={clockMode === value} className="sr-only" name="clockMode" onChange={() => setClockMode(value)} type="radio" value={value} />{label}
            </label>
          ))}
        </div>
        {clockMode === 'ANALOG' ? <select className="mt-4 h-10 w-full rounded-lg border bg-surface px-3 text-sm sm:w-72" name="analogClockStyle" onChange={(event) => setAnalogClockStyle(event.target.value as typeof analogClockStyle)} value={analogClockStyle}>{ANALOG_CLOCK_STYLES.map((value) => <option key={value} value={value}>{labels[value.toLowerCase() as 'classic' | 'minimal' | 'liquid']}</option>)}</select> : <input name="analogClockStyle" type="hidden" value={analogClockStyle} />}
        <div className="mt-5 flex min-h-28 items-center justify-center rounded-xl border bg-sidebar p-4 text-sidebar-foreground"><Clock mode={clockMode} style={analogClockStyle} timeFormat={timeFormat} /></div>
      </section>

      {feedback ? <p className={`rounded-xl border px-4 py-3 text-sm ${state.code === 'saved' ? 'border-success/25 bg-success-surface text-success' : 'border-destructive/25 bg-destructive-surface text-destructive'}`} role="status">{feedback}</p> : null}
      <div className="sticky bottom-0 flex justify-end border-t bg-background/95 py-4 backdrop-blur"><button className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">{pending ? <LoaderCircle className="animate-spin" size={17} /> : null}{pending ? labels.saving : labels.save}</button></div>
    </form>
  )
}
