import type { LucideIcon } from 'lucide-react'

export function MetricCard({ icon: Icon, label, value, tone = 'default' }: { icon: LucideIcon; label: string; value: string | number; tone?: 'default' | 'accent' }) {
  return <article className={`rounded-2xl border p-5 ${tone === 'accent' ? 'border-accent bg-accent text-primary' : 'border-border bg-panel'}`}><div className="flex items-start justify-between gap-3"><p className={`text-sm font-semibold ${tone === 'accent' ? 'text-primary' : 'text-muted-foreground'}`}>{label}</p><Icon className={tone === 'accent' ? 'text-primary' : 'text-muted-foreground'} size={18} /></div><p className="metric-number mt-5 text-4xl font-bold">{value}</p></article>
}
