'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Locale = 'nl' | 'en'

const COPY: Record<Locale, { title: string; description: string; retry: string }> = {
  nl: {
    title: 'Deze pagina kon niet worden geladen',
    description: 'De gegevens zijn tijdelijk niet beschikbaar. Probeer het opnieuw. Als dit blijft gebeuren, neem dan contact op met je beheerder.',
    retry: 'Opnieuw proberen',
  },
  en: {
    title: 'This page could not be loaded',
    description: 'The data is temporarily unavailable. Please try again. If the problem continues, contact your administrator.',
    retry: 'Try again',
  },
}

export default function AppError({ retry }: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const [locale, setLocale] = useState<Locale>('nl')

  useEffect(() => {
    setLocale(document.documentElement.lang === 'en' ? 'en' : 'nl')
  }, [])

  const copy = COPY[locale]
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <section aria-labelledby="app-error-title" className="w-full max-w-lg rounded-[var(--radius-card)] border border-border bg-surface p-8 shadow-sm">
        <div aria-hidden="true" className="mb-4 grid size-11 place-items-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">!</div>
        <h1 className="text-xl font-semibold" id="app-error-title">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.description}</p>
        <Button className="mt-6" onClick={retry}>{copy.retry}</Button>
      </section>
    </main>
  )
}
