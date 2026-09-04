import Link from 'next/link'
import { Surface } from '@/components/ui/surface'

interface GenerationHistoryItem {
  readonly id: string
  readonly templateName: string
  readonly employeeName: string
  readonly employeeNumber: string | null
  readonly templateVersion: number
  readonly status: 'PREVIEW' | 'FINAL'
  readonly generatedByUserId: string
  readonly generatedAt: string
  readonly dossierStatus: 'CREATED' | 'PENDING' | 'SKIPPED'
}

interface GenerationHistoryLabels {
  readonly title: string
  readonly status: string
  readonly generatedAt: string
  readonly generatedBy: string
  readonly dossier: string
  readonly dossierCreated: string
  readonly dossierPending: string
  readonly dossierNotSaved: string
  readonly noHistory: string
  readonly download: string
}

export function GenerationHistory({ items, labels }: { items: readonly Record<string, unknown>[]; labels: GenerationHistoryLabels }) {
  return <Surface className="space-y-4 p-5">
    <h2 className="text-base font-semibold">{labels.title}</h2>
    {items.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noHistory}</p> : <div className="divide-y divide-border">
      {items.map((rawItem) => {
        const item = rawItem as unknown as GenerationHistoryItem
        return <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={item.id}>
          <div>
            <p className="font-medium">{item.templateName} · v{item.templateVersion}</p>
            <p>{item.employeeName}{item.employeeNumber ? ` · ${item.employeeNumber}` : ''}</p>
            <p className="text-muted-foreground">{labels.status}: {item.status} · {labels.generatedAt}: {item.generatedAt}</p>
            <p className="text-muted-foreground">{labels.generatedBy}: {item.generatedByUserId}</p>
            {item.dossierStatus !== 'SKIPPED' ? <p className="text-muted-foreground">{labels.dossier}: {item.dossierStatus === 'CREATED' ? labels.dossierCreated : labels.dossierPending}</p> : <p className="text-muted-foreground">{labels.dossier}: {labels.dossierNotSaved}</p>}
          </div>
          {item.status === 'FINAL' ? <Link className="font-medium text-primary underline" href={`/api/document-studio/generation/${item.id}/download`}>{labels.download}</Link> : null}
        </div>
      })}
    </div>}
  </Surface>
}
