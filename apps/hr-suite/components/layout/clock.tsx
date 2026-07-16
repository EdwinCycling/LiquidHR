'use client'

import { useEffect, useMemo, useState } from 'react'
import type { AnalogClockStyle, ClockMode } from '@/lib/preferences/user-preferences'

export function DigitalClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return <time className="tabular-nums text-lg font-semibold tracking-tight" dateTime={now.toISOString()}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</time>
}

export function AnalogClock({ style }: { style: AnalogClockStyle }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const angles = useMemo(() => ({
    hour: (now.getHours() % 12) * 30 + now.getMinutes() * 0.5,
    minute: now.getMinutes() * 6 + now.getSeconds() * 0.1,
    second: now.getSeconds() * 6,
  }), [now])
  const labels = { CLASSIC: 'classic', MINIMAL: 'minimal', LIQUID: 'liquid' } as const
  return (
    <div aria-label={now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} className={`relative size-16 rounded-full border border-sidebar-border bg-sidebar-accent ${labels[style]}`} role="img">
      <span className="absolute inset-1 rounded-full border border-sidebar-border" />
      <span className="absolute left-1/2 top-1/2 h-5 w-px origin-bottom bg-sidebar-foreground" style={{ transform: `translate(-50%, -100%) rotate(${angles.hour}deg)` }} />
      <span className="absolute left-1/2 top-1/2 h-6 w-px origin-bottom bg-sidebar-foreground" style={{ transform: `translate(-50%, -100%) rotate(${angles.minute}deg)` }} />
      <span className="absolute left-1/2 top-1/2 h-7 w-px origin-bottom bg-primary" style={{ transform: `translate(-50%, -100%) rotate(${angles.second}deg)` }} />
      <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
    </div>
  )
}

export function Clock({ mode, style }: { mode: ClockMode; style: AnalogClockStyle }) {
  if (mode === 'HIDDEN') return null
  return mode === 'DIGITAL' ? <DigitalClock /> : <AnalogClock style={style} />
}
