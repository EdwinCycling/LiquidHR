'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Check, LoaderCircle, Settings, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  updateUserPreferences,
  type PreferencesActionState,
} from '@/app/actions/update-user-preferences'
import { ANALOG_CLOCK_STYLES, UI_THEMES, type UserPreferences } from '@/lib/preferences/user-preferences'

type UiTheme = (typeof UI_THEMES)[number]
const initialPreferencesActionState: PreferencesActionState = { code: 'idle' }

export interface SettingsModalLabels {
  open: string
  close: string
  title: string
  subtitle: string
  language: string
  languageHelp: string
  dutch: string
  english: string
  theme: string
  themeHelp: string
  clock: string
  clockHelp: string
  analog: string
  digital: string
  hidden: string
  clockStyle: string
  classic: string
  minimal: string
  liquid: string
  save: string
  cancel: string
  saving: string
  saved: string
  saveFailed: string
  invalid: string
  unauthenticated: string
  themes: Readonly<Record<UiTheme, { name: string; description: string }>>
}

interface SettingsModalProps {
  collapsed: boolean
  labels: SettingsModalLabels
  preferences: UserPreferences
  onBeforeOpen?: () => void
}

export function SettingsModal({
  collapsed,
  labels,
  preferences,
  onBeforeOpen,
}: SettingsModalProps) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [state, action, pending] = useActionState(
    updateUserPreferences,
    initialPreferencesActionState,
  )
  const [locale, setLocale] = useState(preferences.locale)
  const [theme, setTheme] = useState<UiTheme>(preferences.theme)
  const [clockMode, setClockMode] = useState(preferences.clockMode)
  const [analogClockStyle, setAnalogClockStyle] = useState(preferences.analogClockStyle)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = locale
  }, [locale, theme])

  useEffect(() => {
    if (state.code !== 'saved' || !state.preferences) return
    dialogRef.current?.close()
    router.refresh()
  }, [router, state])

  function openDialog() {
    onBeforeOpen?.()
    setLocale(preferences.locale)
    setTheme(preferences.theme)
    setClockMode(preferences.clockMode)
    setAnalogClockStyle(preferences.analogClockStyle)
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    setTheme(preferences.theme)
    setLocale(preferences.locale)
    setClockMode(preferences.clockMode)
    setAnalogClockStyle(preferences.analogClockStyle)
    dialogRef.current?.close()
  }

  function previewTheme(value: UiTheme) {
    setTheme(value)
  }

  const feedback = state.code === 'saved'
    ? labels.saved
    : state.code === 'invalid'
      ? labels.invalid
      : state.code === 'unauthenticated'
        ? labels.unauthenticated
        : state.code === 'failed'
          ? labels.saveFailed
          : null
  const feedbackIsError = state.code === 'invalid'
    || state.code === 'unauthenticated'
    || state.code === 'failed'

  return (
    <>
      <button
        aria-label={labels.open}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        onClick={openDialog}
        type="button"
      >
        <Settings aria-hidden="true" className="shrink-0" size={18} />
        {!collapsed ? <span>{labels.title}</span> : null}
      </button>

      <dialog
        aria-labelledby="settings-title"
        className="settings-dialog m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl overflow-hidden rounded-2xl border bg-surface p-0 text-foreground shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)]"
        onCancel={(event) => {
          event.preventDefault()
          closeDialog()
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog()
        }}
        ref={dialogRef}
      >
        <form action={action} className="flex max-h-[calc(100dvh-1rem)] flex-col sm:max-h-[calc(100dvh-3rem)]">
          <header className="flex items-start justify-between gap-6 border-b px-5 py-5 sm:px-7">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.02em]" id="settings-title">{labels.title}</h2>
              <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{labels.subtitle}</p>
            </div>
            <button aria-label={labels.close} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={closeDialog} type="button">
              <X aria-hidden="true" size={19} />
            </button>
          </header>

          <div className="overflow-y-auto px-5 py-6 sm:px-7">
            <fieldset>
              <legend className="text-sm font-semibold text-foreground">{labels.language}</legend>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{labels.languageHelp}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {([
                  ['nl', labels.dutch],
                  ['en', labels.english],
                ] as const).map(([value, label]) => (
                  <label className={`relative flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${locale === value ? 'border-focus bg-accent text-accent-foreground' : 'bg-surface-raised hover:bg-muted'}`} key={value}>
                    <input
                      checked={locale === value}
                      className="sr-only"
                      name="locale"
                      onChange={() => setLocale(value)}
                      type="radio"
                      value={value}
                    />
                    <span>{label}</span>
                    {locale === value ? <Check aria-hidden="true" size={17} /> : null}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-7">
              <legend className="text-sm font-semibold text-foreground">{labels.theme}</legend>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{labels.themeHelp}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {UI_THEMES.map((value) => {
                  const selected = theme === value
                  const themeLabel = labels.themes[value]
                  return (
                    <label
                      className={`group relative cursor-pointer overflow-hidden rounded-xl border bg-surface-raised p-3 transition-[border-color,transform] hover:-translate-y-0.5 ${selected ? 'border-focus' : 'hover:border-muted-foreground/45'}`}
                      data-theme={value}
                      key={value}
                    >
                      <input
                        checked={selected}
                        className="sr-only"
                        name="theme"
                        onChange={() => previewTheme(value)}
                        type="radio"
                        value={value}
                      />
                      <span aria-hidden="true" className="mb-3 flex h-12 overflow-hidden rounded-lg border">
                        <span className="w-[28%] bg-sidebar" />
                        <span className="flex flex-1 items-center gap-1.5 bg-background px-2">
                          <span className="h-6 flex-1 rounded bg-surface" />
                          <span className="size-6 rounded bg-primary" />
                        </span>
                      </span>
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-sm font-semibold text-foreground">{themeLabel.name}</span>
                          <span className="mt-1 block text-xs leading-4 text-muted-foreground">{themeLabel.description}</span>
                        </span>
                        <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${selected ? 'border-focus bg-accent text-accent-foreground' : 'bg-surface'}`}>
                          {selected ? <Check aria-hidden="true" size={13} strokeWidth={3} /> : null}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <fieldset className="mt-7">
              <legend className="text-sm font-semibold text-foreground">{labels.clock}</legend>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{labels.clockHelp}</p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {([
                  ['ANALOG', labels.analog], ['DIGITAL', labels.digital], ['HIDDEN', labels.hidden],
                ] as const).map(([value, label]) => (
                  <label className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-medium ${clockMode === value ? 'border-focus bg-accent text-accent-foreground' : 'bg-surface-raised hover:bg-muted'}`} key={value}>
                    <input checked={clockMode === value} className="sr-only" name="clockMode" onChange={() => setClockMode(value)} type="radio" value={value} />
                    {label}
                  </label>
                ))}
              </div>
              {clockMode === 'ANALOG' ? (
                <div className="mt-4">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="analog-clock-style">{labels.clockStyle}</label>
                  <select className="mt-1 h-10 w-full rounded-lg border bg-surface px-3 text-sm" id="analog-clock-style" name="analogClockStyle" onChange={(event) => setAnalogClockStyle(event.target.value as typeof analogClockStyle)} value={analogClockStyle}>
                    {ANALOG_CLOCK_STYLES.map((value) => <option key={value} value={value}>{labels[value.toLowerCase() as 'classic' | 'minimal' | 'liquid']}</option>)}
                  </select>
                </div>
              ) : null}
            </fieldset>

            {feedback ? (
              <p className={`mt-5 rounded-lg border px-3 py-2.5 text-sm ${feedbackIsError ? 'border-destructive/25 bg-destructive-surface text-destructive' : 'border-success/25 bg-success-surface text-success'}`} role={feedbackIsError ? 'alert' : 'status'}>
                {feedback}
              </p>
            ) : null}
          </div>

          <footer className="mt-auto flex items-center justify-end gap-3 border-t bg-surface-raised px-5 py-4 sm:px-7">
            <button className="h-10 rounded-lg border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted" onClick={closeDialog} type="button">
              {labels.cancel}
            </button>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-wait disabled:opacity-65" disabled={pending} type="submit">
              {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : null}
              {pending ? labels.saving : labels.save}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  )
}
