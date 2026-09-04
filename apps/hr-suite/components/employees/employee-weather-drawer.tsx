'use client'

import { Building2, Cloud, House, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { WorkWeather } from '@/lib/weather/open-meteo'
import { getNextWorkingForecastDay, type WeatherDay } from '@/lib/weather/forecast'
import { PressureBar, WeatherGlyph, WindDirection } from '@/components/startpage/weather-instrument'

interface EmployeeWeatherLabels {
  weatherTitle: string
  weatherOpen: string
  weatherClose: string
  weatherUnavailable: string
  weatherToday: string
  weatherTomorrow: string
  weatherNextWorkingDay: string
  weatherDayToggle: string
  weatherTodayMax: string
  weatherForecastHigh: string
  weatherForecastLow: string
  weatherPressureUp: string
  weatherPressureDown: string
  weatherPressureSteady: string
  weatherHumidity: string
  weatherWind: string
  weatherPressure: string
  weatherLocationToggle: string
  weatherWork: string
  weatherHome: string
}

type ForecastSelection = 'today' | 'next'

function dateTimestamp(date: string): number | null {
  const timestamp = Date.parse(`${date}T12:00:00Z`)
  return Number.isFinite(timestamp) ? timestamp : null
}

function tomorrowFor(date: string): string | null {
  const timestamp = dateTimestamp(date)
  return timestamp === null ? null : new Date(timestamp + 86_400_000).toISOString().slice(0, 10)
}

function formatForecastDate(date: string, locale: string): string {
  const timestamp = dateTimestamp(date)
  if (timestamp === null) return date
  return new Intl.DateTimeFormat(locale.startsWith('en') ? 'en-GB' : 'nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  }).format(new Date(timestamp))
}

function nextDayLabel(day: WeatherDay, today: WeatherDay, locale: string, labels: EmployeeWeatherLabels): string {
  const prefix = day.date === tomorrowFor(today.date) ? labels.weatherTomorrow : labels.weatherNextWorkingDay
  return `${prefix}: ${formatForecastDate(day.date, locale)}`
}

export function EmployeeWeatherDrawer({ weather, homeWeather, labels, locale }: { weather: WorkWeather | null; homeWeather: WorkWeather | null; labels: EmployeeWeatherLabels; locale: string }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'work' | 'home'>('work')
  const [selection, setSelection] = useState<ForecastSelection>('today')
  const activeWeather = mode === 'home' && homeWeather ? homeWeather : weather
  const today = activeWeather?.forecast[0] ?? null
  const nextWorkingDay = activeWeather ? getNextWorkingForecastDay(activeWeather.forecast) : null
  const selectedDay = selection === 'next' && nextWorkingDay ? nextWorkingDay : today
  const showingCurrent = selection === 'today' || !nextWorkingDay
  const selectedLabel = selectedDay
    ? selection === 'today' || !nextWorkingDay
      ? labels.weatherToday
      : nextDayLabel(selectedDay, today ?? selectedDay, locale, labels)
    : labels.weatherToday

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  return <>
    <button aria-label={labels.weatherOpen} className="inline-flex h-10 min-h-10 w-10 items-center justify-center rounded-lg border border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground transition hover:bg-primary-foreground/20" onClick={() => setOpen(true)} title={labels.weatherOpen} type="button">
      {weather ? <WeatherGlyph code={weather.current.weatherCode} size={19} /> : <Cloud aria-hidden="true" className="text-primary-foreground/70" size={19} />}
    </button>
    {open ? <div className="fixed inset-0 z-[60] bg-foreground/35" onMouseDown={() => setOpen(false)} role="presentation">
      <aside aria-label={labels.weatherTitle} aria-modal="true" className="absolute right-0 top-0 flex h-full w-[min(24rem,calc(100vw-1rem))] flex-col overflow-y-auto border-l bg-surface p-5 text-foreground shadow-2xl sm:p-7" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <header className="flex items-start justify-between gap-4 border-b pb-5">
          <div>
            <p className="eyebrow">{labels.weatherTitle}</p>
            {activeWeather ? <p className="mt-1 text-sm text-muted-foreground">{activeWeather.location.city ?? activeWeather.location.name}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {homeWeather ? <div aria-label={labels.weatherLocationToggle} className="flex items-center rounded-full border bg-background p-0.5" role="group">
              <button aria-label={labels.weatherWork} aria-pressed={mode === 'work'} className={`grid size-8 place-items-center rounded-full transition ${mode === 'work' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`} onClick={() => { setMode('work'); setSelection('today') }} title={labels.weatherWork} type="button"><Building2 aria-hidden="true" size={15} /></button>
              <button aria-label={labels.weatherHome} aria-pressed={mode === 'home'} className={`grid size-8 place-items-center rounded-full transition ${mode === 'home' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`} onClick={() => { setMode('home'); setSelection('today') }} title={labels.weatherHome} type="button"><House aria-hidden="true" size={15} /></button>
            </div> : null}
            <button aria-label={labels.weatherClose} className="button-secondary h-9 min-h-9 w-9 p-0" onClick={() => setOpen(false)} title={labels.weatherClose} type="button"><X aria-hidden="true" size={17} /></button>
          </div>
        </header>
        {activeWeather ? <div className="mt-5 space-y-6">
          {today && nextWorkingDay ? <div aria-label={labels.weatherDayToggle} className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] border border-border bg-background p-1" role="tablist">
            <button aria-selected={selection === 'today'} className={`min-h-9 rounded-[var(--radius-control)] px-2 text-xs font-semibold transition ${selection === 'today' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`} onClick={() => setSelection('today')} role="tab" type="button">{labels.weatherToday}</button>
            <button aria-selected={selection === 'next'} className={`min-h-9 rounded-[var(--radius-control)] px-2 text-xs font-semibold transition ${selection === 'next' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`} onClick={() => setSelection('next')} role="tab" type="button">{nextDayLabel(nextWorkingDay, today, locale, labels)}</button>
          </div> : null}
          <div className="rounded-[var(--radius-surface)] border border-border bg-accent/35 p-5">
            <p className="eyebrow text-primary">{selectedLabel}</p>
            {selectedDay && !showingCurrent ? <p className="mt-1 text-sm text-muted-foreground">{formatForecastDate(selectedDay.date, locale)}</p> : null}
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-5xl font-semibold tracking-[-0.08em] tabular-nums">{showingCurrent ? `${activeWeather.current.temperature.toFixed(1)}°` : `${Math.round(selectedDay?.temperatureMin ?? 0)}° – ${Math.round(selectedDay?.temperatureMax ?? 0)}°`}</p>
                <p className="mt-2 text-sm text-muted-foreground">{showingCurrent ? `${labels.weatherTodayMax} ${Math.round(today?.temperatureMax ?? activeWeather.current.temperatureMax)}°` : `${labels.weatherForecastHigh} ${Math.round(selectedDay?.temperatureMax ?? 0)}° · ${labels.weatherForecastLow} ${Math.round(selectedDay?.temperatureMin ?? 0)}°`}</p>
              </div>
              <WeatherGlyph code={selectedDay?.weatherCode ?? activeWeather.current.weatherCode} size={46} />
            </div>
          </div>
          {showingCurrent ? <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[var(--radius-surface)] border border-border bg-background p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.weatherHumidity}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{Math.round(activeWeather.current.humidity)}%</p></div>
              <div className="rounded-[var(--radius-surface)] border border-border bg-background p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.weatherWind}</p><div className="mt-2 flex items-center gap-3"><WindDirection degrees={activeWeather.current.windDirection} speed={activeWeather.current.windSpeed} /><span className="font-semibold tabular-nums">{Math.round(activeWeather.current.windSpeed)} km/u</span></div></div>
            </div>
            <section><h3 className="text-sm font-semibold">{labels.weatherPressure}</h3><div className="mt-4"><PressureBar current={activeWeather.current} labels={labels} /></div></section>
          </> : null}
        </div> : <p className="mt-6 rounded-[var(--radius-surface)] border border-dashed p-5 text-sm text-muted-foreground">{labels.weatherUnavailable}</p>}
      </aside>
    </div> : null}
  </>
}
