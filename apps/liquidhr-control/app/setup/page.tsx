import { FileKey, ShieldAlert } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionary'
import { Surface } from '@/components/ui/surface'

export default function SetupPage() {
  const labels = getDictionary().setup
  return <main className="control-grid flex min-h-screen items-center justify-center p-4 sm:p-6"><Surface variant="overlay" className="max-w-2xl p-8 sm:p-12"><span className="grid h-12 w-12 place-items-center rounded-[var(--radius-control)] bg-warning-subtle text-warning"><ShieldAlert /></span><p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-warning">{labels.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{labels.title}</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">{labels.body}</p><div className="mt-8 rounded-[var(--radius-surface)] border border-border bg-surface-subtle p-5"><div className="flex gap-3"><FileKey className="shrink-0" size={20} /><div><p className="font-medium">{labels.file}: <code>apps/liquidhr-control/.env.local</code></p><p className="mt-2 text-sm text-muted-foreground">{labels.source}</p><p className="mt-2 text-sm text-muted-foreground">{labels.variables}</p></div></div></div><p className="mt-5 text-sm font-medium text-destructive">{labels.security}</p></Surface></main>
}
