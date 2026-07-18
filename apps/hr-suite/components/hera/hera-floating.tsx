'use client'

import { MessageCircleHeart, PanelRight, PanelRightClose, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { HeRaChat, type HeRaLabels } from './hera-chat'
import { clampHeRaWidth, parseHeRaDockState, type HeRaDockState } from './hera-floating-state'

const DOCK_KEY = 'liquid-hr:hera:dock'
const WIDTH_KEY = 'liquid-hr:hera:width'

export function HeRaFloating({ labels }: { labels: HeRaLabels }) {
  const [open, setOpen] = useState(false)
  const [dock, setDock] = useState<HeRaDockState>('overlay')
  const [width, setWidth] = useState(420)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDock(parseHeRaDockState(window.localStorage.getItem(DOCK_KEY)))
      const storedWidth = Number(window.localStorage.getItem(WIDTH_KEY))
      if (Number.isFinite(storedWidth)) setWidth(clampHeRaWidth(storedWidth))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function toggleDock() {
    const next = dock === 'docked' ? 'overlay' : 'docked'
    setDock(next)
    window.localStorage.setItem(DOCK_KEY, next)
  }

  function changeWidth(value: number) {
    const next = clampHeRaWidth(value)
    setWidth(next)
    window.localStorage.setItem(WIDTH_KEY, String(next))
  }

  return (
    <>
      {!open ? (
        <button aria-label={labels.title} className="fixed bottom-5 left-5 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2" onClick={() => setOpen(true)} type="button">
          <MessageCircleHeart aria-hidden="true" size={23} />
        </button>
      ) : null}
      {open ? (
        <div className={dock === 'docked' ? 'fixed inset-y-0 right-0 z-50 w-[min(100vw,48rem)] border-l bg-background shadow-2xl' : 'fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-3 sm:p-6'}>
          <section className={dock === 'docked' ? 'h-full w-full' : 'relative h-[min(90dvh,52rem)] w-full max-w-5xl'} style={dock === 'docked' ? { width: `min(100vw, ${width}px)` } : undefined}>
            <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl border bg-surface/90 p-1 shadow-sm backdrop-blur">
              <button aria-label={dock === 'docked' ? labels.closeSettings : labels.settings} className="grid size-8 place-items-center rounded-lg hover:bg-muted" onClick={toggleDock} type="button">{dock === 'docked' ? <PanelRightClose aria-hidden="true" size={16} /> : <PanelRight aria-hidden="true" size={16} />}</button>
              {dock === 'docked' ? <input aria-label={labels.title} className="w-20 accent-primary" max={760} min={320} onChange={(event) => changeWidth(Number(event.target.value))} type="range" value={width} /> : null}
              <button aria-label={labels.cancel} className="grid size-8 place-items-center rounded-lg hover:bg-muted" onClick={() => setOpen(false)} type="button"><X aria-hidden="true" size={16} /></button>
            </div>
            <HeRaChat labels={labels} />
          </section>
        </div>
      ) : null}
    </>
  )
}
