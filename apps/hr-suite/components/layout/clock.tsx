'use client'

import { useEffect, useMemo, useState } from 'react'
import type { AnalogClockStyle, ClockMode } from '@/lib/preferences/user-preferences'

export function DigitalClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  if (!now) return <span aria-hidden="true" className="inline-block h-7 w-24" />
  return <time className="tabular-nums text-lg font-semibold tracking-tight" dateTime={now.toISOString()}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</time>
}

export function AnalogClock({ style }: { style: AnalogClockStyle }) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const angles = useMemo(() => ({
    hour: now ? (now.getHours() % 12) * 30 + now.getMinutes() * 0.5 : 0,
    minute: now ? now.getMinutes() * 6 + now.getSeconds() * 0.1 : 0,
    second: now ? now.getSeconds() * 6 : 0,
  }), [now])
  if (!now) return <div aria-hidden="true" className="size-16 rounded-full border border-sidebar-border bg-sidebar-accent/40" />
  const faceClass = {
    CLASSIC: 'border-2 border-sidebar-foreground/65 bg-sidebar-accent shadow-inner',
    MINIMAL: 'border border-sidebar-border bg-transparent',
    LIQUID: 'border border-primary/45 bg-gradient-to-br from-primary/30 via-sidebar-accent to-accent shadow-lg',
  } as const
  return (
    <div aria-label={now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} className={`relative size-16 rounded-full ${faceClass[style]}`} role="img">
      {style === 'CLASSIC' ? <>{[0, 3, 6, 9].map((hour) => <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sidebar-foreground" key={hour} style={{ transform: `translate(-50%, -50%) rotate(${hour * 30}deg) translateY(-25px)` }} />)}</> : null}
      {style === 'LIQUID' ? <span className="absolute inset-1 rounded-full border border-primary/25 bg-surface/15 backdrop-blur-sm" /> : null}
      <span className="absolute left-1/2 top-1/2 h-5 w-0.5 origin-bottom rounded-full bg-sidebar-foreground" style={{ transform: `translate(-50%, -100%) rotate(${angles.hour}deg)` }} />
      <span className="absolute left-1/2 top-1/2 h-6 w-px origin-bottom bg-sidebar-foreground" style={{ transform: `translate(-50%, -100%) rotate(${angles.minute}deg)` }} />
      {style !== 'MINIMAL' ? <span className="absolute left-1/2 top-1/2 h-7 w-px origin-bottom bg-primary" style={{ transform: `translate(-50%, -100%) rotate(${angles.second}deg)` }} /> : null}
      <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
    </div>
  )
}

export function Clock({ mode, style }: { mode: ClockMode; style: AnalogClockStyle }) {
  if (mode === 'HIDDEN') return null
  return mode === 'DIGITAL' ? <DigitalClock /> : <AnalogClock style={style} />
}
