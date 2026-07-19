'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

export interface SettingsAccordionSection { id: string; title: ReactNode; children: ReactNode }

export function SettingsAccordion({ sections, initialOpen }: { sections: SettingsAccordionSection[]; initialOpen?: string }) {
  const [open, setOpen] = useState<string | null>(initialOpen ?? null)
  useEffect(() => {
    if (!initialOpen) return
    const element = document.getElementById(`settings-section-${initialOpen}`)
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [initialOpen])
  return <div className="space-y-3">{sections.map((section) => { const isOpen = open === section.id; return <section className="scroll-mt-6 rounded-2xl border bg-surface shadow-sm" id={`settings-section-${section.id}`} key={section.id}><button aria-controls={`settings-panel-${section.id}`} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 p-5 text-left" onClick={() => setOpen(isOpen ? null : section.id)} type="button"><span className="text-base font-semibold">{section.title}</span><ChevronDown className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={18} /></button>{isOpen ? <div className="border-t p-5" id={`settings-panel-${section.id}`}>{section.children}</div> : null}</section> })}</div>
}
