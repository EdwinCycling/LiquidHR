import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AdministrationSettingsContextBar } from '@/components/settings/administration-settings-context-bar'
import { SettingsAccordion } from '@/components/settings/settings-accordion'
import {
  EmploymentCatalogManager,
  EmploymentGeneralSettings,
} from '@/components/settings/employment-contract-settings'
import { EmploymentRegulationsManager } from '@/components/settings/employment-regulations-manager'
import { SalaryApplicationSettings } from '@/components/settings/salary-application-settings'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getEmploymentSettings } from '@/lib/employment/employment-settings'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { requireAdministrationSettingsContext } from '@/lib/settings/administration-selection'
import { redirect } from 'next/navigation'

export default async function EmploymentContractSettingsPage() {
  let context: Awaited<ReturnType<typeof requireAdministrationSettingsContext>>
  try {
    context = await requireAdministrationSettingsContext('/settings/employment-contracts')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  let settings: Awaited<ReturnType<typeof getEmploymentSettings>>
  try {
    settings = await getEmploymentSettings()
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const [t, settingsT, locale] = await Promise.all([
    getTranslator('employment'),
    getTranslator('settings'),
    getLocale(),
  ])
  const labels = {
    search: t('catalogSearch'), code: t('catalogCode'), name: t('catalogName'),
    add: t('catalogAdd'), edit: t('catalogEdit'), save: t('catalogSave'), cancel: t('catalogCancel'), active: t('active'), inactive: t('catalogInactive'),
    activate: t('catalogActivate'), deactivate: t('catalogDeactivate'),
    empty: t('catalogEmpty'), failed: t('changeFailed'),
  }
  return <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10">
    <AdminSettingsPageHeader
      backLabel={settingsT('admin.backToOverview')}
      eyebrow={settingsT('admin.eyebrow')}
      title={t('employmentSettingsTitle')}
      subtitle={t('employmentSettingsSubtitle')}
    />
    <AdministrationSettingsContextBar context={context} returnTo="/settings/employment-contracts" />
    <SettingsAccordion sections={[
      {
        id: 'general',
        title: t('general'),
        children: <EmploymentGeneralSettings
          defaultCountryCode={settings.defaultCountryCode}
          frequencies={settings.salaryFrequencies.map((row) => ({ id: row.id, code: row.code, name: row.name, isActive: row.is_active, numericValue: row.periods_per_year }))}
          labels={{ country: t('defaultEmploymentCountry'), paymentFrequency: t('paymentFrequency'), monthly: t('monthly'), fourWeekly: t('fourWeekly'), save: t('confirm'), saved: t('changeSaved'), failed: t('changeFailed'), search: t('catalogSearch'), empty: t('catalogEmpty') }}
        />,
      },
      {
        id: 'laborConditions',
        title: t('laborConditions'),
        children: <EmploymentRegulationsManager
          timelines={settings.laborConditionTimelines}
          labels={{
            search: t('catalogSearch'), addRegulation: t('regulationAdd'), addSuccessor: t('regulationAddSuccessor'), edit: t('catalogEdit'), save: t('catalogSave'), cancel: t('catalogCancel'), name: t('catalogName'), validFrom: t('regulationValidFrom'), standardHours: t('standardWeeklyHours'), successor: t('regulationSuccessor'), successors: t('regulationSuccessors'), current: t('regulationCurrent'), historical: t('regulationHistorical'), validUntil: t('regulationValidUntil'), empty: t('catalogEmpty'), failed: t('changeFailed'), description: t('regulationTimelineDescription'), newTitle: t('regulationNewTitle'), editTitle: t('regulationEditTitle'), successorTitle: t('regulationSuccessorTitle'), continuityHint: t('regulationContinuityHint'), probationMaximum: t('probationMaximum'), probationOneMonth: t('probationOneMonth'), probationTwoMonths: t('probationTwoMonths'),
            salaryStructures: { sectionTitle: t('salaryStructures.sectionTitle'), description: t('salaryStructures.description'), scalesAndSteps: t('salaryStructures.scalesAndSteps'), salaryBands: t('salaryStructures.salaryBands'), linked: t('salaryStructures.linked'), noActiveRevision: t('salaryStructures.noActiveRevision'), save: t('salaryStructures.save'), cancel: t('salaryStructures.cancel'), unsaved: t('salaryStructures.unsaved'), saving: t('salaryStructures.saving'), saved: t('salaryStructures.saved'), failed: t('salaryStructures.failed'), readOnly: t('salaryStructures.readOnly') },
          }}
          salaryStructureCatalog={settings.salaryStructureCatalog}
          locale={locale}
        />,
      },
      {
        id: 'salaryApplication',
        title: t('salaryCalculation'),
        children: <SalaryApplicationSettings
          routes={settings.salaryApplicationSettings.routes}
          structureIds={settings.salaryApplicationSettings.structureIds}
          canWrite={settings.salaryApplicationSettings.canWrite}
          structures={(settings.salaryStructureCatalog?.structures ?? []).map((structure) => ({
            id: structure.id,
            code: structure.code,
            name: structure.name,
            structureType: structure.structure_type,
            isActive: structure.is_active,
          }))}
          labels={{
            intro: t('salaryApplication.intro'),
            routeTitle: t('salaryApplication.routeTitle'),
            routeDescription: t('salaryApplication.routeDescription'),
            manual: t('salaryApplication.manual'),
            manualDescription: t('salaryApplication.manualDescription'),
            minimumWage: t('salaryApplication.minimumWage'),
            minimumWageDescription: t('salaryApplication.minimumWageDescription'),
            scaleWithSteps: t('salaryApplication.scaleWithSteps'),
            scaleWithStepsDescription: t('salaryApplication.scaleWithStepsDescription'),
            salaryBand: t('salaryApplication.salaryBand'),
            salaryBandDescription: t('salaryApplication.salaryBandDescription'),
            structuresTitle: t('salaryApplication.structuresTitle'),
            structuresDescription: t('salaryApplication.structuresDescription'),
            searchStructures: t('salaryApplication.searchStructures'),
            scales: t('salaryApplication.scales'),
            bands: t('salaryApplication.bands'),
            noStructures: t('salaryApplication.noStructures'),
            save: t('salaryApplication.save'),
            saved: t('salaryApplication.saved'),
            failed: t('salaryApplication.failed'),
            readOnly: t('salaryApplication.readOnly'),
          }}
        />,
      },
      {
        id: 'flexPhases',
        title: t('flexPhase'),
        children: <EmploymentCatalogManager
          catalog="FLEX_PHASE"
          numericLabel={t('sortOrder')}
          rows={settings.flexPhases.map((row) => ({ id: row.id, code: row.code, name: row.name, isActive: row.is_active, numericValue: row.sort_order }))}
          labels={labels}
        />,
      },
      {
        id: 'salaryFrequencies',
        title: t('frequency'),
        children: <EmploymentCatalogManager
          catalog="SALARY_FREQUENCY"
          numericLabel={t('periodsPerYear')}
          rows={settings.salaryFrequencies.map((row) => ({ id: row.id, code: row.code, name: row.name, isActive: row.is_active, numericValue: row.periods_per_year }))}
          labels={labels}
        />,
      },
      {
        id: 'costCarriers',
        title: t('costCarrier'),
        children: <EmploymentCatalogManager
          catalog="COST_CARRIER"
          numericLabel={null}
          rows={settings.costCarriers.map((row) => ({ id: row.id, code: row.code, name: row.name, isActive: row.is_active, numericValue: null }))}
          labels={labels}
        />,
      },
      {
        id: 'costCenters',
        title: t('costCenter'),
        children: <EmploymentCatalogManager catalog="COST_CENTER" numericLabel={null} rows={settings.costCenters.map((row) => ({ id: row.id, code: row.code, name: row.name, isActive: row.is_active, numericValue: null }))} labels={labels} />,
      },
    ]} />
  </main>
}
