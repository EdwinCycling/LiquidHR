import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/dictionary'
import './globals.css'

const dictionary = getDictionary()

export const metadata: Metadata = {
  title: dictionary.appName,
  description: dictionary.metadataDescription,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>
}
