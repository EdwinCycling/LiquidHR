import Link from 'next/link'
import { FilePlus2, Settings2 } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import type { DocumentStudioTemplateSummary } from '@/lib/document-studio/service'

export interface TemplateLibraryLabels {
  readonly title: string
  readonly new: string
  readonly types: string
  readonly profiles: string
  readonly empty: string
  readonly name: string
  readonly kind: string
  readonly language: string
  readonly category: string
  readonly status: string
  readonly version: string
  readonly updated: string
  readonly draft: string
  readonly active: string
  readonly archived: string
  readonly open: string
  readonly categories: Readonly<Record<string, string>>
  readonly kinds: Readonly<Record<string, string>>
}

export function TemplateLibrary({ templates, labels }: { templates: readonly DocumentStudioTemplateSummary[]; labels: TemplateLibraryLabels }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Link className={buttonClasses({ className: 'gap-2' })} href="/document-studio/templates/new"><FilePlus2 aria-hidden="true" />{labels.new}</Link>
        <Link className={buttonClasses({ variant: 'secondary', className: 'gap-2' })} href="/document-studio/document-types"><Settings2 aria-hidden="true" />{labels.types}</Link>
        <Link className={buttonClasses({ variant: 'secondary', className: 'gap-2' })} href="/document-studio/profiles"><Settings2 aria-hidden="true" />{labels.profiles}</Link>
      </div>
      {templates.length === 0 ? <Surface className="border-dashed p-8 text-sm text-muted-foreground" variant="subtle">{labels.empty}</Surface> : (
        <Surface className="overflow-x-auto">
          <table className="min-w-[52rem] w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-subtle text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{[labels.name, labels.kind, labels.language, labels.category, labels.status, labels.version, labels.updated].map((label) => <th className="px-4 py-3 font-semibold" key={label}>{label}</th>)}<th className="px-4 py-3"><span className="sr-only">{labels.open}</span></th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map((template) => (
                <tr className="hover:bg-surface-subtle" key={template.id}>
                  <td className="px-4 py-3"><Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/document-studio/templates/${template.id}`}>{template.name}</Link><div className="text-xs text-muted-foreground">{template.template_key}</div></td>
                  <td className="px-4 py-3">{labels.kinds[template.kind] ?? template.kind}</td>
                  <td className="px-4 py-3">{template.language}</td>
                  <td className="px-4 py-3">{labels.categories[template.category_code] ?? template.category_code}</td>
                  <td className="px-4 py-3">{template.draft ? labels.draft : template.lifecycle === 'ARCHIVED' ? labels.archived : labels.active}</td>
                  <td className="px-4 py-3">{template.activeVersion ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(template.updated_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right"><Link className="text-primary underline-offset-4 hover:underline" href={`/document-studio/templates/${template.id}`}>{labels.open}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      )}
    </div>
  )
}
