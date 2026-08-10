'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Building2, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, House, Minus, Sun } from 'lucide-react'
import type { WeatherCurrent, WorkWeather } from '@/lib/weather/open-meteo'

export interface WeatherLabels {
  weatherTitle: string
  weatherUnavailable: string
  weatherPressureUp: string
  weatherPressureDown: string
  weatherPressureSteady: string
  weatherTodayMax: string
  weatherLocationToggle: string
  weatherWork: string
  weatherHome: string
  weatherHomeUnavailable: string
}

interface WeatherInstrumentProps {
  workWeather: WorkWeather | null
  homeWeather: WorkWeather | null
  labels: WeatherLabels
}

export function WeatherGlyph({ code, size = 18, className = 'text-warning' }: { code: number; size?: number; className?: string }) {
  const props = { 'aria-hidden': true, className, size, strokeWidth: 1.8 }
  if (code === 0) return <Sun {...props} />
  if (code === 1 || code === 2) return <CloudSun {...props} />
  if (code === 3) return <Cloud {...props} />
  if (code === 45 || code === 48) return <CloudFog {...props} />
  if (code >= 51 && code <= 67) return <CloudRain {...props} />
  if (code >= 71 && code <= 77) return <CloudSnow {...props} />
  if (code >= 80 && code <= 82) return <CloudRain {...props} />
  if (code >= 95) return <CloudLightning {...props} />
  return <Cloud {...props} />
}

function PressureTrendGlyph({ trend }: { trend: WeatherCurrent['pressureTrend'] }) {
  if (trend === 'up') return <ArrowUp aria-hidden="true" size={14} strokeWidth={2.5} />
  if (trend === 'down') return <ArrowDown aria-hidden="true" size={14} strokeWidth={2.5} />
  return <Minus aria-hidden="true" size={14} strokeWidth={2.5} />
}

export function PressureBar({ current, labels }: { current: WeatherCurrent; labels: Pick<WeatherLabels, 'weatherPressureUp' | 'weatherPressureDown' | 'weatherPressureSteady'> }) {
  const position = Math.min(96, Math.max(4, ((current.pressure - 980) / 60) * 100))
  const trendLabel = current.pressureTrend === 'up' ? labels.weatherPressureUp : current.pressureTrend === 'down' ? labels.weatherPressureDown : labels.weatherPressureSteady
  return <div aria-label={`${Math.round(current.pressure)} hPa, ${trendLabel}`} className="mt-0">
    <div className="relative h-3.5 overflow-visible rounded-md border-2 border-foreground/40 bg-muted-foreground/20 shadow-inner">
      <div className="flex h-full overflow-hidden rounded-[0.2rem]"><span className="w-1/3 bg-warning/80" /><span className="w-1/3 bg-success/75" /><span className="w-1/3 bg-accent/80" /></div>
      <span aria-hidden="true" className="absolute -top-3 -translate-x-1/2 text-foreground" style={{ left: `${position}%` }}><PressureTrendGlyph trend={current.pressureTrend} /></span>
    </div>
    <div className="mt-0 flex items-center justify-between font-mono text-[0.5rem] font-semibold tabular-nums text-foreground/70"><span>980</span><span>{Math.round(current.pressure)} hPa</span><span>1040</span></div>
  </div>
}

function compassDirection(degrees: number) {
  const directions = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'] as const
  return directions[Math.round(degrees / 45) % directions.length]
}

export function WindDirection({ degrees, speed }: { degrees: number; speed: number }) {
  const direction = compassDirection(degrees)
  return <div aria-label={`Windrichting ${direction}, ${Math.round(speed)} km/u`} className="flex flex-col items-center gap-0.5 [&>span:last-child]:hidden">
    <span className="grid size-8 place-items-center rounded-full border-2 border-foreground/50 bg-background/25 shadow-inner"><span style={{ transform: `rotate(${degrees}deg)` }}><ArrowUp aria-hidden="true" className="text-foreground" size={18} strokeWidth={2.4} /></span></span>
    <span className="font-mono text-[0.6rem] font-semibold tabular-nums text-foreground/70">{direction}</span>
    <span className="font-mono text-[0.55rem] font-semibold tabular-nums text-foreground/70">{Math.round(degrees)}°</span>
  </div>
}

function WeatherLocationToggle({ mode, homeAvailable, labels, onChange }: { mode: 'work' | 'home'; homeAvailable: boolean; labels: WeatherLabels; onChange: (mode: 'work' | 'home') => void }) {
  return <div aria-label={labels.weatherLocationToggle} className="flex shrink-0 items-center gap-0.5 rounded-full border border-foreground/15 bg-background/20 p-0.5" role="group">
    <button aria-label={labels.weatherWork} aria-pressed={mode === 'work'} className={`grid size-5 place-items-center rounded-full transition ${mode === 'work' ? 'bg-background/70 text-foreground shadow-sm' : 'text-foreground/55 hover:bg-background/30'}`} onClick={() => onChange('work')} title={labels.weatherWork} type="button"><Building2 aria-hidden="true" size={11} strokeWidth={2.2} /></button>
    <button aria-label={homeAvailable ? labels.weatherHome : labels.weatherHomeUnavailable} aria-pressed={mode === 'home'} className={`grid size-5 place-items-center rounded-full transition ${mode === 'home' ? 'bg-background/70 text-foreground shadow-sm' : 'text-foreground/55 hover:bg-background/30'} disabled:cursor-not-allowed disabled:opacity-35`} disabled={!homeAvailable} onClick={() => onChange('home')} title={homeAvailable ? labels.weatherHome : labels.weatherHomeUnavailable} type="button"><House aria-hidden="true" size={11} strokeWidth={2.2} /></button>
  </div>
}

export function WeatherInstrument({ workWeather, homeWeather, labels }: WeatherInstrumentProps) {
  const [mode, setMode] = useState<'work' | 'home'>('work')
  const data = mode === 'home' ? homeWeather : workWeather
  const locationLabel = mode === 'home' ? labels.weatherHome : labels.weatherWork

  return <aside aria-label={`${labels.weatherTitle}: ${locationLabel}`} className="hidden w-[15rem] shrink-0 xl:block">
    {data ? <div className="rounded-[1rem] border-[0.25rem] border-primary-foreground/35 bg-muted px-2 py-1 text-foreground shadow-[inset_0_0.15rem_0.4rem_color-mix(in_srgb,var(--foreground)_18%,transparent),0_0.7rem_1.4rem_color-mix(in_srgb,var(--primary)_25%,transparent)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col items-start">
          <span className="font-mono text-[1.8rem] font-semibold leading-[0.9] tracking-[-0.12em] tabular-nums">{data.current.temperature.toFixed(1)}°</span>
          <span className="mt-0.5 whitespace-nowrap font-mono text-[0.47rem] font-semibold leading-3 tabular-nums text-foreground/65">{labels.weatherTodayMax} {Math.round(data.current.temperatureMax)}°</span>
        </div>
        <WeatherLocationToggle homeAvailable={homeWeather !== null} labels={labels} mode={mode} onChange={setMode} />
        <WindDirection degrees={data.current.windDirection} speed={data.current.windSpeed} />
      </div>
      <PressureBar current={data.current} labels={labels} />
      <div className="mt-0 flex items-end justify-between gap-2"><span className="font-mono text-[1.8rem] font-semibold leading-[0.9] tracking-[-0.1em] tabular-nums">{Math.round(data.current.humidity)}%</span><WeatherGlyph code={data.current.weatherCode} /></div>
      <p className="mt-0.5 break-words text-center text-[0.58rem] font-semibold leading-3 text-foreground/75" title={data.location.city ?? data.location.name}>{data.location.city ?? data.location.name}</p>
    </div> : <p className="text-sm text-primary-foreground/65">{labels.weatherUnavailable}</p>}
  </aside>
}
