import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { CompanyDocumentLibrary } from '@/components/documents/company-document-library'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { listCompanyDocuments } from '@/lib/documents/company-document-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'

export default async function CompanyDocumentsPage() {
  const [documents, t, locale] = await Promise.all([listCompanyDocuments(), getTranslator('documents'), getLocale()])
  let canWrite = false
  let canDelete = false
  try { await requirePermission('company-document:write'); canWrite = true } catch (error) { if (!(error instanceof AuthorizationError)) throw error }
  try { await requirePermission('company-document:delete'); canDelete = true } catch (error) { if (!(error instanceof AuthorizationError)) throw error }
  return (
    <main>
      <PageShell className="space-y-6 py-7 lg:py-10" width="standard">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/dashboard"><ArrowLeft aria-hidden="true" size={16} />{t('backToDashboard')}</Link>
        <CompanyDocumentLibrary
          canDelete={canDelete}
          canWrite={canWrite}
          documents={documents}
          locale={locale}
          labels={{
            addedOn: t('addedOn'), cancel: t('cancel'), close: t('viewerClose'), companyCreateDescription: t('companyCreateDescription'), companyCreateTitle: t('companyCreateTitle'), companyDeleteDescription: t('companyDeleteDescription'), companyEmpty: t('companyEmpty'), companyInvalid: t('companyInvalid'), companySave: t('companySave'), companySubtitle: t('companySubtitle'), companyTitle: t('companyTitle'), delete: t('delete'), deleteCancel: t('deleteCancel'), deleteConfirm: t('deleteConfirm'), deleteTitle: t('deleteTitle'), discardCancel: t('discardCancel'), discardConfirm: t('discardConfirm'), discardDescription: t('discardDescription'), discardTitle: t('discardTitle'), failed: t('failed'), file: t('file'), fileRules: t('fileRules'), fileSelected: t('fileSelected'), moreActions: t('moreActions'), saving: t('saving'), titleLabel: t('documentTitle'), unsupported: t('viewerUnsupported'), upload: t('upload'), view: t('view'), download: t('download'),
          }}
        />
      </PageShell>
    </main>
  )
}
