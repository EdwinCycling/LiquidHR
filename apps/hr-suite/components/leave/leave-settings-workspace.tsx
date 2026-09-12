'use client'

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ScrollableTabs, TabButton } from '@/components/patterns/scrollable-tabs'

type Section = 'types' | 'profiles' | 'sets' | 'yearEnd'

type Labels = {
  tabs: Record<Section, string>
  tabsAriaLabel: string
  intros: Record<Section, string>
}

function resolveSection(value: string | null): Section {
  return value === 'profiles' || value === 'sets' || value === 'yearEnd' ? value : 'types'
}

export function LeaveSettingsWorkspace({ sections, labels }: { sections: Record<Section, ReactNode>; labels: Labels }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const section = resolveSection(searchParams.get('section'))
  function changeSection(nextSection: Section): void {
    const params = new URLSearchParams(searchParams.toString())
    if (nextSection === 'types') params.delete('section')
    else params.set('section', nextSection)
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`)
  }
  return <div className="space-y-5">
    <div>
      <ScrollableTabs ariaLabel={labels.tabsAriaLabel} leftLabel={labels.tabsAriaLabel} rightLabel={labels.tabsAriaLabel}>
        <div aria-label={labels.tabsAriaLabel} role="tablist">
          {(Object.keys(labels.tabs) as Section[]).map((item) => <TabButton active={section === item} key={item} onClick={() => changeSection(item)}>{section === item ? <Check aria-hidden="true" className="mr-1.5 inline size-4" /> : null}{labels.tabs[item]}</TabButton>)}
        </div>
      </ScrollableTabs>
      <p className="mt-3 text-sm text-muted-foreground">{labels.intros[section]}</p>
    </div>
    <div aria-label={labels.tabs[section]} role="tabpanel">{sections[section]}</div>
  </div>
}
