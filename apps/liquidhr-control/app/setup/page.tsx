import { FileKey, ShieldAlert } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionary'

export default function SetupPage() {
  const labels = getDictionary().setup
  return <main className="control-grid flex min-h-screen items-center justify-center p-6"><section className="panel-shadow max-w-2xl rounded-[2rem] border border-border bg-panel p-8 sm:p-12"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-warning-soft text-warning"><ShieldAlert /></span><p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-warning">{labels.eyebrow}</p><h1 className="mt-3 text-4xl font-bold tracking-[-0.05em]">{labels.title}</h1><p className="mt-4 leading-7 text-muted-foreground">{labels.body}</p><div className="mt-8 rounded-2xl border border-border bg-panel-soft p-5"><div className="flex gap-3"><FileKey className="shrink-0" size={20} /><div><p className="font-bold">{labels.file}: <code>apps/liquidhr-control/.env.local</code></p><p className="mt-2 text-sm text-muted-foreground">{labels.source}</p><p className="mt-2 text-sm text-muted-foreground">{labels.variables}</p></div></div></div><p className="mt-5 text-sm font-semibold text-danger">{labels.security}</p></section></main>
}
