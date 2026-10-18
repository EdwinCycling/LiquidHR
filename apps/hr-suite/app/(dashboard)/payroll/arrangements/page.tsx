import Link from 'next/link'
import { ArrowUpRight, Blocks } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { PayrollProfessionalNavigation } from '@/components/payroll/payroll-professional-navigation'
import { Surface } from '@/components/ui/surface'
import { CaoSetupOverview } from '@/components/payroll/cao-setup-overview'
import { EmploymentRegulationsManager } from '@/components/settings/employment-regulations-manager'
import { caoSetupPackageOptions } from '@/lib/payroll/cao-setup-catalog'
import { getCaoSetupPageData } from '@/lib/payroll/cao-setup-service'
import { getEmploymentSettings } from '@/lib/employment/employment-settings'
import { getLocale, getTranslator } from '@/lib/i18n/server'

export default async function PayrollArrangementsPage() {
  const [settings, t, locale] = await Promise.all([getEmploymentSettings(), getTranslator('payrollProfessional'), getLocale()])
  const data = await getCaoSetupPageData(settings)
  const nav = { overview: t('overview'), runs: t('runs'), corrections: t('corrections'), compare: t('compare'), arrangements: t('arrangements'), settings: t('settings') }
  return <PageShell className="space-y-6 py-6 sm:py-8">
    <PageHeader title={t('arrangements')} description={t('arrangementsDescription')} />
    <PayrollProfessionalNavigation active="arrangements" labels={nav} />
    <CaoSetupOverview data={data} locale={locale} labels={{
      catalogTitle: t('caoSetupCatalogTitle'), catalogDescription: t('caoSetupCatalogDescription'), grossEngineSupported: t('caoGrossEngineSupported'), sourceReviewRequired: t('caoSourceReviewRequired'), effectivePeriod: t('effectivePeriod'), versionHash: t('versionHash'), standardHours: t('standardHours'), pensionFund: t('pensionFund'), pensionSourceTitle: t('caoPensionSourceTitle'), pensionSourceDescription: t('caoPensionSourceDescription'), pensionFields: t('caoPensionFields'), pensionRecordsTitle: t('caoPensionRecordsTitle'), pensionRecordsDescription: t('caoPensionRecordsDescription'), pensionRecordsEmpty: t('caoPensionRecordsEmpty'), pensionVersion: t('pensionVersion'), pensionFranchise: t('pensionFranchise'), pensionCap: t('pensionCap'), pensionEmployeeShare: t('pensionEmployeeShare'), pensionEmployerShare: t('pensionEmployerShare'), pensionSourceHash: t('pensionSourceHash'), caoMappingsTitle: t('caoMappingsTitle'), caoMappingsDescription: t('caoMappingsDescription'), caoMappingsEmpty: t('caoMappingsEmpty'), mappingFor: t('mappingFor'), openEmploymentSettings: t('openEmploymentSettings'), openPensionAssignments: t('openPensionAssignments'), sourceStatusReference: t('sourceStatusReference'), sourceStatusValidated: t('sourceStatusValidated'),
    }} />
    <Surface className="space-y-4 p-5">
      <h2 className="text-lg font-semibold">{t('caoRegulationSetupTitle')}</h2>
      <p className="text-sm text-muted-foreground">{t('caoRegulationSetupDescription')}</p>
      <EmploymentRegulationsManager
        caoPackages={caoSetupPackageOptions()}
        labels={{
          search: t('catalogSearch'), addRegulation: t('regulationAdd'), addSuccessor: t('regulationAddSuccessor'), edit: t('catalogEdit'), save: t('catalogSave'), cancel: t('catalogCancel'), name: t('catalogName'), validFrom: t('regulationValidFrom'), standardHours: t('standardWeeklyHours'), successor: t('regulationSuccessor'), successors: t('regulationSuccessors'), current: t('regulationCurrent'), historical: t('regulationHistorical'), validUntil: t('regulationValidUntil'), empty: t('catalogEmpty'), failed: t('changeFailed'), description: t('regulationTimelineDescription'), newTitle: t('regulationNewTitle'), editTitle: t('regulationEditTitle'), successorTitle: t('regulationSuccessorTitle'), continuityHint: t('regulationContinuityHint'), probationMaximum: t('probationMaximum'), probationOneMonth: t('probationOneMonth'), probationTwoMonths: t('probationTwoMonths'), caoPackage: t('caoPackage'), caoPackageNone: t('caoPackageNone'), caoPackageSource: t('caoPackageSource'),
          salaryStructures: { sectionTitle: t('salaryStructures.sectionTitle'), description: t('salaryStructures.description'), scalesAndSteps: t('salaryStructures.scalesAndSteps'), salaryBands: t('salaryStructures.salaryBands'), linked: t('salaryStructures.linked'), noActiveRevision: t('salaryStructures.noActiveRevision'), save: t('salaryStructures.save'), cancel: t('salaryStructures.cancel'), unsaved: t('salaryStructures.unsaved'), saving: t('salaryStructures.saving'), saved: t('salaryStructures.saved'), failed: t('salaryStructures.failed'), readOnly: t('salaryStructures.readOnly') },
        }}
        locale={locale}
        salaryStructureCatalog={settings.salaryStructureCatalog}
        timelines={settings.laborConditionTimelines}
      />
    </Surface>
    <Surface><Link href="/payroll-components" className="flex min-h-24 items-center gap-4 rounded-[var(--radius-surface)] p-5 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Blocks aria-hidden="true" /></span><span className="min-w-0 flex-1"><strong className="block">{t('componentCatalog')}</strong><span className="mt-1 block text-sm text-muted-foreground">{t('componentCatalogDescription')}</span></span><ArrowUpRight aria-hidden="true" size={17} /></Link></Surface>
  </PageShell>
}
