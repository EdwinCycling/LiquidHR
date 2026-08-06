import Link from 'next/link'
import { ArrowLeft, FileText, HeartHandshake } from 'lucide-react'
import { SettingsAccordion } from '@/components/settings/settings-accordion'
import { AdministrationSettingsContextBar } from '@/components/settings/administration-settings-context-bar'
import { DocumentCategoryManager, RelationTypeManager } from '@/components/master-data/catalog-managers'
import { EndReasonManager } from '@/components/master-data/end-reason-manager'
import { listDocumentCategories, listRelationTypes } from '@/lib/master-data/catalogs'
import { listEndReasonCountries, listEndReasons } from '@/lib/master-data/end-reasons'
import { getTranslator } from '@/lib/i18n/server'
import { requireAdministrationSettingsContext } from '@/lib/settings/administration-selection'

interface Props { searchParams: Promise<{ section?: string; country?: string }> }

export default async function MasterDataPage({ searchParams }: Props) {
  const context = await requireAdministrationSettingsContext('/master-data')
  const { section, country } = await searchParams
  const countryCode = country && /^[A-Z]{2}$/.test(country.toUpperCase()) ? country.toUpperCase() : 'NL'
  const [t, endReasons, endReasonCountries, categories, relationTypes] = await Promise.all([getTranslator('masterData'), listEndReasons(countryCode), listEndReasonCountries(), listDocumentCategories(), listRelationTypes()])
  const labels = { code: t('catalog.code'), name: t('catalog.name'), nameNl: t('catalog.nameNl'), nameEn: t('catalog.nameEn'), description: t('catalog.description'), add: t('catalog.add'), saving: t('catalog.saving'), activate: t('catalog.activate'), deactivate: t('catalog.deactivate'), delete: t('delete'), deleteConfirm: t('deleteConfirm'), deleteFailed: t('deleteFailed'), inUse: t('inUse') }
  return <main className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" href="/settings?section=hrSetup"><ArrowLeft size={16} />{t('backToSettings')}</Link><header className="mb-7 mt-5"><p className="eyebrow">{t('eyebrow')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('masterDataTitle')}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('masterDataSubtitle')}</p></header><AdministrationSettingsContextBar context={context} returnTo="/master-data" /><SettingsAccordion initialOpen={section} sections={[{ id: 'endReasons', title: t('endReasonsTitle'), children: <div><p className="mb-4 text-sm text-muted-foreground">{t('endReasonsSubtitle')}</p><EndReasonManager countries={endReasonCountries} countryCode={countryCode} reasons={endReasons} labels={{ country: t('endReasonsCountry'), addCountry: t('endReasonsAddCountry'), code: t('code'), nameNl: t('catalog.nameNl'), nameEn: t('catalog.nameEn'), add: t('endReasonsAdd'), edit: t('edit'), save: t('save'), cancel: t('cancel'), active: t('active'), inactive: t('inactive'), activate: t('activate'), deactivate: t('deactivate'), delete: t('delete'), inUse: t('inUse'), failed: t('failed'), emptyCountry: t('endReasonsEmptyCountry'), fallbackReason: t('endReasonsFallback') }} /></div> }, { id: 'documentCategories', title: <span className="inline-flex items-center gap-2"><FileText size={17} />{t('documentCategoriesTitle')}</span>, children: <DocumentCategoryManager categories={categories} labels={labels} /> }, { id: 'relationTypes', title: <span className="inline-flex items-center gap-2"><HeartHandshake size={17} />{t('relationTypesTitle')}</span>, children: <RelationTypeManager relationTypes={relationTypes} labels={labels} /> }]} /></main>
}
