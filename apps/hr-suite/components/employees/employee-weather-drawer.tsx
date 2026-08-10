'use client'

import { Building2, Cloud, House, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { WorkWeather } from '@/lib/weather/open-meteo'
import { PressureBar, WeatherGlyph, WindDirection } from '@/components/startpage/weather-instrument'

interface EmployeeWeatherLabels {
  weatherTitle: string
  weatherOpen: string
  weatherClose: string
  weatherUnavailable: string
  weatherTodayMax: string
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

export function EmployeeWeatherDrawer({ weather, homeWeather, labels }: { weather: WorkWeather | null; homeWeather: WorkWeather | null; labels: EmployeeWeatherLabels }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'work' | 'home'>('work')
  const activeWeather = mode === 'home' && homeWeather ? homeWeather : weather

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
              <button aria-label={labels.weatherWork} aria-pressed={mode === 'work'} className={`grid size-8 place-items-center rounded-full transition ${mode === 'work' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`} onClick={() => setMode('work')} title={labels.weatherWork} type="button"><Building2 aria-hidden="true" size={15} /></button>
              <button aria-label={labels.weatherHome} aria-pressed={mode === 'home'} className={`grid size-8 place-items-center rounded-full transition ${mode === 'home' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`} onClick={() => setMode('home')} title={labels.weatherHome} type="button"><House aria-hidden="true" size={15} /></button>
            </div> : null}
            <button aria-label={labels.weatherClose} className="button-secondary h-9 min-h-9 w-9 p-0" onClick={() => setOpen(false)} title={labels.weatherClose} type="button"><X aria-hidden="true" size={17} /></button>
          </div>
        </header>
        {activeWeather ? <div className="mt-6 space-y-6">
          <div className="flex items-end justify-between gap-4 rounded-2xl bg-accent/35 p-5">
            <div><p className="font-mono text-5xl font-semibold tracking-[-0.08em] tabular-nums">{activeWeather.current.temperature.toFixed(1)}°</p><p className="mt-2 text-sm text-muted-foreground">{labels.weatherTodayMax} {Math.round(activeWeather.current.temperatureMax)}°</p></div>
            <WeatherGlyph code={activeWeather.current.weatherCode} size={46} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-background p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.weatherHumidity}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{Math.round(activeWeather.current.humidity)}%</p></div>
            <div className="rounded-xl border bg-background p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.weatherWind}</p><div className="mt-2 flex items-center gap-3"><WindDirection degrees={activeWeather.current.windDirection} speed={activeWeather.current.windSpeed} /><span className="font-semibold tabular-nums">{Math.round(activeWeather.current.windSpeed)} km/u</span></div></div>
          </div>
          <section><h3 className="text-sm font-semibold">{labels.weatherPressure}</h3><div className="mt-4"><PressureBar current={activeWeather.current} labels={labels} /></div></section>
        </div> : <p className="mt-6 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{labels.weatherUnavailable}</p>}
      </aside>
    </div> : null}
  </>
}
