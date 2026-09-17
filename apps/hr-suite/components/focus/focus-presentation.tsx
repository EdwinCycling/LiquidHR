'use client'

import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { buttonClasses } from '@/components/ui/button'
import type { FocusPresentation as Presentation } from '@/lib/focus/access-state'

export const FOCUS_PRESENTATION_STORAGE_KEY = 'liquidhr:focus:presentation'

interface FocusPresentationProps {
  presentation: Presentation
  canOpenFull: boolean
  isPreboarding: boolean
  labels: { label: string; focus: string; full: string }
}

function savePresentation(presentation: Presentation) {
  try {
    window.localStorage.setItem(FOCUS_PRESENTATION_STORAGE_KEY, presentation)
  } catch {
    // Navigatie blijft beschikbaar wanneer de browser opslag blokkeert.
  }
}

export function FocusPresentation({ presentation, canOpenFull, isPreboarding, labels }: FocusPresentationProps) {
  const router = useRouter()
  const fullAvailable = canOpenFull && !isPreboarding

  useEffect(() => {
    if (!fullAvailable) return
    let preference: string | null = null
    try {
      preference = window.localStorage.getItem(FOCUS_PRESENTATION_STORAGE_KEY)
    } catch {
      // Zonder browservoorkeur blijft de serverpresentatie leidend.
    }
    if (preference === 'FULL' || (preference !== 'FOCUS' && presentation === 'FULL')) {
      router.replace('/dashboard/start')
    }
  }, [fullAvailable, presentation, router])

  return (
    <nav aria-label={labels.label} className="flex flex-wrap items-center gap-2">
      <Link aria-current="page" className={buttonClasses({ variant: 'secondary' })} href="/focus" onClick={() => savePresentation('FOCUS')}>{labels.focus}</Link>
      {fullAvailable ? <Link className={buttonClasses({ variant: 'ghost', className: 'whitespace-normal text-left' })} href="/dashboard/start" onClick={() => savePresentation('FULL')} prefetch={false}><LayoutDashboard aria-hidden="true" />{labels.full}</Link> : null}
    </nav>
  )
}
