import type { Metadata } from 'next'
import { Work_Sans } from 'next/font/google'
import type { CSSProperties } from 'react'
import { getTranslator } from '@/lib/i18n/server'
import { getUserPreferences } from '@/lib/preferences/server'
import './globals.css'

const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-work-sans',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const common = await getTranslator('common')
  return {
    title: common('appName'),
    description: common('metadataDescription'),
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const preferences = await getUserPreferences()
  const brandStyle = preferences.useCompanyTheme && preferences.companyBranding ? {
    '--primary': preferences.companyBranding.primaryColor,
    '--primary-hover': preferences.companyBranding.primaryColor,
    '--accent': preferences.companyBranding.accentColor,
    '--accent-foreground': preferences.companyBranding.primaryColor,
    '--focus': preferences.companyBranding.primaryColor,
    '--sidebar': preferences.companyBranding.sidebarColor,
    '--sidebar-accent': preferences.companyBranding.primaryColor,
  } as CSSProperties : undefined

  return (
    <html data-theme={preferences.theme} lang={preferences.locale} style={brandStyle} suppressHydrationWarning>
      <body className={workSans.variable}>{children}</body>
    </html>
  )
}
