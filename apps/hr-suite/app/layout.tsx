import type { Metadata } from 'next'
import { getTranslator } from '@/lib/i18n/server'
import { getUserPreferences } from '@/lib/preferences/server'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const common = await getTranslator('common')
  return {
    title: common('appName'),
    description: common('metadataDescription'),
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const preferences = await getUserPreferences()

  return (
    <html data-theme={preferences.theme} lang={preferences.locale} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
