import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CompanyDocumentLibrary } from '@/components/documents/company-document-library'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { listCompanyDocuments } from '@/lib/documents/company-document-service'
import { getTranslator } from '@/lib/i18n/server'

export default async function CompanyDocumentsPage() {
  const t = await getTranslator('documents')
  const documents = await listCompanyDocuments()
  let canWrite = false
  try { await requirePermission('company-document:write'); canWrite = true } catch (error) { if (!(error instanceof AuthorizationError)) throw error }
  return <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" href="/dashboard"><ArrowLeft size={16} />{t('backToDashboard')}</Link><CompanyDocumentLibrary canWrite={canWrite} documents={documents} labels={{ title: t('companyTitle'), subtitle: t('companySubtitle'), upload: t('upload'), titleLabel: t('documentTitle'), file: t('file'), save: t('companySave'), saving: t('saving'), empty: t('companyEmpty'), view: t('view'), download: t('download'), delete: t('delete'), close: t('viewerClose'), unsupported: t('viewerUnsupported'), invalid: t('companyInvalid'), failed: t('failed') }} /></main>
}
