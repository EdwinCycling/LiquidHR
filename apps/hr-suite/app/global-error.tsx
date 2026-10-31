'use client'

import { useSyncExternalStore } from 'react'

type Locale = 'nl' | 'en'

function subscribeLocale(): () => void {
  return () => undefined
}

function browserLocale(): Locale {
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'nl'
}

function serverLocale(): Locale {
  return 'nl'
}

const COPY: Record<Locale, { title: string; description: string; retry: string }> = {
  nl: {
    title: 'Deze pagina kon niet worden geladen',
    description: 'De gegevens zijn tijdelijk niet beschikbaar. Probeer het opnieuw. Als dit blijft gebeuren, neem contact op met je beheerder.',
    retry: 'Opnieuw proberen',
  },
  en: {
    title: 'This page could not be loaded',
    description: 'The data is temporarily unavailable. Please try again. If the problem continues, contact your administrator.',
    retry: 'Try again',
  },
}

export default function GlobalError({ retry }: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const locale = useSyncExternalStore(subscribeLocale, browserLocale, serverLocale)

  const copy = COPY[locale]
  return (
    <html lang={locale}>
      <body style={{ margin: 0, fontFamily: 'inherit', color: 'var(--foreground, CanvasText)', background: 'var(--background, Canvas)' }}>
        <main aria-labelledby="global-error-title" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <section style={{ boxSizing: 'border-box', width: '100%', maxWidth: 520, padding: 32, border: '1px solid var(--border, currentColor)', borderRadius: 'var(--radius-card, 0.75rem)', background: 'var(--surface, Canvas)' }}>
            <h1 id="global-error-title" style={{ margin: 0, fontSize: 22 }}>{copy.title}</h1>
            <p style={{ margin: '12px 0 24px', lineHeight: 1.6, color: '#475569' }}>
              {copy.description}
            </p>
            <button
              onClick={retry}
              style={{ border: '1px solid var(--primary, Highlight)', borderRadius: 'var(--radius-control, 0.5rem)', padding: '10px 16px', color: 'var(--primary-foreground, HighlightText)', background: 'var(--primary, Highlight)', font: 'inherit', cursor: 'pointer' }}
            >
              {copy.retry}
            </button>
          </section>
        </main>
      </body>
    </html>
  )
}
