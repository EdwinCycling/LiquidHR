'use client'

import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export interface TenantPageAccordionSection {
  id: string
  title: string
  description: string
  icon: ReactNode
  badge?: string | number
  children: ReactNode
}

export function TenantPageAccordion({ sections, initialOpen }: {
  sections: TenantPageAccordionSection[]
  initialOpen?: string
}) {
  const [openSection, setOpenSection] = useState<string | null>(initialOpen ?? null)

  return (
    <div className="mt-7 space-y-3">
      {sections.map((section) => {
        const isOpen = openSection === section.id
        const triggerId = `tenant-section-${section.id}-trigger`
        const panelId = `tenant-section-${section.id}-panel`

        return (
          <section className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface" id={`tenant-section-${section.id}`} key={section.id}>
            <button
              aria-controls={panelId}
              aria-expanded={isOpen}
              className="flex min-h-[76px] w-full items-center gap-4 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus sm:p-5"
              id={triggerId}
              onClick={() => setOpenSection(isOpen ? null : section.id)}
              type="button"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-surface-subtle text-primary">
                {section.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold">{section.title}</span>
                  {section.badge !== undefined ? <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-muted-foreground">{section.badge}</span> : null}
                </span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">{section.description}</span>
              </span>
              <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen ? (
              <div aria-labelledby={triggerId} className="border-t border-border-subtle p-4 sm:p-5" id={panelId} role="region">
                {section.children}
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
