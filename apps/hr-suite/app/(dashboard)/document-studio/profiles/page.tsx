import Link from 'next/link'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { DocumentProfileManager } from '@/components/document-studio/document-profile-manager'
import { createDocumentStudioLabels } from '@/lib/document-studio/labels'
import { listAdministrationOptions, listAssets, listProfiles } from '@/lib/document-studio/service'
import { getTranslator } from '@/lib/i18n/server'

export default async function DocumentStudioProfilesPage() {
  const t = await getTranslator('documentStudio'); const labels = createDocumentStudioLabels(t); const [profiles, administrations, assets] = await Promise.all([listProfiles(), listAdministrationOptions(), listAssets()])
  return <PageShell className="space-y-6 py-7 lg:py-10" width="standard"><Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/document-studio">{labels.editor.back}</Link><PageHeader description={labels.profiles.subtitle} title={labels.profiles.title} /><DocumentProfileManager administrations={administrations} assets={assets} initial={profiles} labels={labels.profiles} /></PageShell>
}
