import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionary'

export default function NoAccessPage() {
  const labels = getDictionary().noAccess
  return <main className="control-grid flex min-h-screen items-center justify-center p-6"><section className="panel-shadow max-w-xl rounded-[2rem] border border-border bg-panel p-10 text-center"><ShieldX className="mx-auto text-danger" size={42} /><p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-danger">{labels.eyebrow}</p><h1 className="mt-3 text-4xl font-bold tracking-[-0.05em]">{labels.title}</h1><p className="mt-4 leading-7 text-muted-foreground">{labels.body}</p><Link className="mt-8 inline-flex rounded-xl bg-accent px-5 py-3 font-bold text-primary transition-colors hover:bg-accent/80" href="/auth/signout">{labels.action}</Link></section></main>
}
