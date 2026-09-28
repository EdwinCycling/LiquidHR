import type { LucideIcon } from 'lucide-react'
import { Surface } from '@/components/ui/surface'

export function MetricCard({ icon: Icon, label, value, tone = 'default' }: { icon: LucideIcon; label: string; value: string | number; tone?: 'default' | 'accent' }) {
  return <Surface variant={tone === 'accent' ? 'subtle' : 'default'} className={tone === 'accent' ? 'border-primary/20 bg-accent text-accent-foreground' : ''}><article className="p-5"><div className="flex items-start justify-between gap-3"><p className={`text-sm font-medium ${tone === 'accent' ? 'text-accent-foreground' : 'text-muted-foreground'}`}>{label}</p><Icon className={tone === 'accent' ? 'text-accent-foreground' : 'text-muted-foreground'} size={18} /></div><p className="metric-number mt-5 text-3xl font-semibold">{value}</p></article></Surface>
}
