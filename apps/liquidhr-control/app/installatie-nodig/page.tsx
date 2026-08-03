import { DatabaseZap } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionary'

export default function InstallationPage() {
  const labels = getDictionary().installation
  return <main className="control-grid flex min-h-screen items-center justify-center p-6"><section className="panel-shadow max-w-xl rounded-[2rem] border border-border bg-panel p-10"><DatabaseZap className="text-warning" size={42} /><p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-warning">{labels.eyebrow}</p><h1 className="mt-3 text-4xl font-bold tracking-[-0.05em]">{labels.title}</h1><p className="mt-4 leading-7 text-muted-foreground">{labels.body}</p><code className="mt-6 block rounded-xl bg-primary p-4 text-sm text-primary-foreground">20260802230000_add_liquidhr_control_plane.sql</code></section></main>
}
