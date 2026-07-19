import Link from 'next/link'
import { ArrowLeft, BriefcaseBusiness, Coins, FileText, HeartHandshake } from 'lucide-react'
import { SettingsAccordion } from '@/components/settings/settings-accordion'
import { DocumentCategoryManager, RelationTypeManager } from '@/components/master-data/catalog-managers'
import { EndReasonManager } from '@/components/master-data/end-reason-manager'
import { listDocumentCategories, listRelationTypes } from '@/lib/master-data/catalogs'
import { listEndReasons } from '@/lib/master-data/end-reasons'
import { getTranslator } from '@/lib/i18n/server'

interface Props { searchParams: Promise<{ section?: string }> }

export default async function MasterDataPage({ searchParams }: Props) {
  const [{ section }, t, endReasons, categories, relationTypes] = await Promise.all([searchParams, getTranslator('masterData'), listEndReasons(), listDocumentCategories(), listRelationTypes()])
  const labels = { code: t('catalog.code'), name: t('catalog.name'), description: t('catalog.description'), add: t('catalog.add'), saving: t('catalog.saving'), activate: t('catalog.activate'), deactivate: t('catalog.deactivate') }
  return <main className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" href="/settings?section=hrSetup"><ArrowLeft size={16} />{t('backToSettings')}</Link><header className="mb-7 mt-5"><p className="eyebrow">{t('eyebrow')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('title')}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('subtitle')}</p></header><SettingsAccordion initialOpen={section} sections={[{ id: 'endReasons', title: t('endReasonsTitle'), children: <div><p className="mb-4 text-sm text-muted-foreground">{t('endReasonsSubtitle')}</p><EndReasonManager reasons={endReasons} labels={{ active: t('active'), inactive: t('inactive'), toggle: t('toggle'), delete: t('delete'), inUse: t('inUse') }} /></div> }, { id: 'documentCategories', title: <span className="inline-flex items-center gap-2"><FileText size={17} />{t('documentCategoriesTitle')}</span>, children: <DocumentCategoryManager categories={categories} labels={labels} /> }, { id: 'relationTypes', title: <span className="inline-flex items-center gap-2"><HeartHandshake size={17} />{t('relationTypesTitle')}</span>, children: <RelationTypeManager relationTypes={relationTypes} labels={labels} /> }, { id: 'otherCatalogs', title: t('otherCatalogsTitle'), children: <div className="grid gap-3 sm:grid-cols-2"><Link className="rounded-xl border p-4 hover:border-primary/40" href="/master-data/jobs"><BriefcaseBusiness size={18} /><strong className="mt-2 block">{t('jobsLink')}</strong><span className="mt-1 block text-sm text-muted-foreground">{t('jobsLinkDescription')}</span></Link><Link className="rounded-xl border p-4 hover:border-primary/40" href="/master-data/salary-scales"><Coins size={18} /><strong className="mt-2 block">{t('salaryLink')}</strong><span className="mt-1 block text-sm text-muted-foreground">{t('salaryLinkDescription')}</span></Link></div> }]} /></main>
}
