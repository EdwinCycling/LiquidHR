import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AdministrationSettingsContextBar } from '@/components/settings/administration-settings-context-bar'
import { SettingsAccordion } from '@/components/settings/settings-accordion'
import {
  EmploymentCatalogManager,
  EmploymentGeneralSettings,
} from '@/components/settings/employment-contract-settings'
import { EmploymentRegulationsManager } from '@/components/settings/employment-regulations-manager'
import { getEmploymentSettings } from '@/lib/employment/employment-settings'
import { getTranslator } from '@/lib/i18n/server'
import { requireAdministrationSettingsContext } from '@/lib/settings/administration-selection'

export default async function EmploymentContractSettingsPage() {
  const context = await requireAdministrationSettingsContext('/settings/employment-contracts')
  const [settings, t, settingsT] = await Promise.all([
    getEmploymentSettings(),
    getTranslator('employment'),
    getTranslator('settings'),
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
