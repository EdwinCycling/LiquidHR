'use client'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

export interface SettingsAccordionSection { id: string; title: ReactNode; children: ReactNode }

export function SettingsAccordion({ sections, initialOpen, alwaysOpen = false, onOpenChange }: { sections: SettingsAccordionSection[]; initialOpen?: string; alwaysOpen?: boolean; onOpenChange?: (sectionId: string | null) => void }) {
  const [open, setOpen] = useState<string | null>(initialOpen ?? null)
  useEffect(() => {
    if (!initialOpen) return
    const element = document.getElementById(`settings-section-${initialOpen}`)
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [initialOpen])
  return <div className="space-y-3">{sections.map((section) => { const isOpen = open === section.id; return <section className="scroll-mt-6 rounded-[var(--radius-surface)] border border-border bg-surface" id={`settings-section-${section.id}`} key={section.id}><button aria-controls={`settings-panel-${section.id}`} aria-expanded={isOpen} className="flex min-h-14 w-full items-center justify-between gap-4 rounded-[var(--radius-surface)] p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus" onClick={() => { const nextOpen = isOpen && !alwaysOpen ? null : section.id; setOpen(nextOpen); onOpenChange?.(nextOpen) }} type="button"><span className="text-base font-semibold">{section.title}</span><ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></button>{isOpen ? <div className="border-t border-border-subtle p-5" id={`settings-panel-${section.id}`}>{section.children}</div> : null}</section> })}</div>
}
