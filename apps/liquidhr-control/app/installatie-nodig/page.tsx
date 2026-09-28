import { DatabaseZap } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionary'
import { Surface } from '@/components/ui/surface'

export default function InstallationPage() {
  const labels = getDictionary().installation
  return <main className="control-grid flex min-h-screen items-center justify-center p-4 sm:p-6"><Surface variant="overlay" className="max-w-xl p-8 sm:p-10"><DatabaseZap className="text-warning" size={42} /><p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-warning">{labels.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{labels.title}</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">{labels.body}</p><code className="mt-6 block rounded-[var(--radius-control)] bg-primary p-4 text-sm text-primary-foreground">20260802230000_add_liquidhr_control_plane.sql</code></Surface></main>
}
