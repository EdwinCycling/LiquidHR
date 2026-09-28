import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionary'
import { Surface } from '@/components/ui/surface'
import { buttonClasses } from '@/components/ui/button'

export default function NoAccessPage() {
  const labels = getDictionary().noAccess
  return <main className="control-grid flex min-h-screen items-center justify-center p-4 sm:p-6"><Surface variant="overlay" className="max-w-xl p-8 text-center sm:p-10"><ShieldX className="mx-auto text-destructive" size={42} /><p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-destructive">{labels.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{labels.title}</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">{labels.body}</p><Link className={`${buttonClasses({ variant: 'secondary' })} mt-8`} href="/auth/signout">{labels.action}</Link></Surface></main>
}
