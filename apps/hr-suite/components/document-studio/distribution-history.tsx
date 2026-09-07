import Link from 'next/link'

interface DistributionHistoryLabels {
  readonly title: string
  readonly status: string
  readonly requested: string
  readonly final: string
  readonly failed: string
  readonly created: string
  readonly open: string
  readonly empty: string
}

export function DistributionHistory({ items, labels }: { items: readonly Record<string, unknown>[]; labels: DistributionHistoryLabels }) {
  return <section className="space-y-3"><h2 className="text-lg font-semibold">{labels.title}</h2>{items.length === 0 ? <p className="text-sm text-muted-foreground">{labels.empty}</p> : <div className="overflow-x-auto rounded-[var(--radius-surface)] border border-border"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-surface"><tr><th className="px-4 py-3">{labels.created}</th><th className="px-4 py-3">{labels.status}</th><th className="px-4 py-3">{labels.requested}</th><th className="px-4 py-3">{labels.final}</th><th className="px-4 py-3">{labels.failed}</th><th className="px-4 py-3" /></tr></thead><tbody>{items.map((item) => <tr className="border-b border-border last:border-0" key={String(item.id)}><td className="px-4 py-3">{String(item.created_at ?? '')}</td><td className="px-4 py-3">{String(item.status ?? '')}</td><td className="px-4 py-3">{String(item.requested_count ?? 0)}</td><td className="px-4 py-3">{String(item.final_count ?? 0)}</td><td className="px-4 py-3">{String(item.failed_count ?? 0)}</td><td className="px-4 py-3"><Link className="underline" href={`/document-studio/distributions/${String(item.id)}`}>{labels.open}</Link></td></tr>)}</tbody></table></div>}</section>
}
