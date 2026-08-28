import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AdministrationSettingsContextBar } from '@/components/settings/administration-settings-context-bar'
import { EmployeeDirectorySettingsForm } from '@/components/settings/employee-directory-settings-form'
import { getEmployeeDirectorySettings } from '@/lib/employee-directory/service'
import { getTranslator } from '@/lib/i18n/server'
import { requireAdministrationSettingsContext } from '@/lib/settings/administration-selection'
import { PageShell } from '@/components/layout/page-shell'

export default async function EmployeeDirectorySettingsPage() {
  const context = await requireAdministrationSettingsContext('/settings/employee-directory')
  const [settings, messages] = await Promise.all([getEmployeeDirectorySettings(), getTranslator('settings')])
  return <PageShell className="py-8 lg:py-10" width="standard">
    <AdminSettingsPageHeader backLabel={messages('admin.backToOverview')} eyebrow={messages('admin.eyebrow')} title={messages('employeeDirectory.title')} subtitle={messages('employeeDirectory.subtitle')} />
    <AdministrationSettingsContextBar context={context} returnTo="/settings/employee-directory" />
    <EmployeeDirectorySettingsForm initial={settings} labels={{
      enabled: messages('employeeDirectory.enabled'),
      enabledDescription: messages('employeeDirectory.enabledDescription'),
      fieldsTitle: messages('employeeDirectory.fieldsTitle'),
      fieldsDescription: messages('employeeDirectory.fieldsDescription'),
      name: messages('employeeDirectory.name'),
      nameAlwaysOn: messages('employeeDirectory.nameAlwaysOn'),
      jobDepartment: messages('employeeDirectory.jobDepartment'),
      workEmail: messages('employeeDirectory.workEmail'),
      workPhone: messages('employeeDirectory.workPhone'),
      presence: messages('employeeDirectory.presence'),
      schedule: messages('employeeDirectory.schedule'),
      cancel: messages('employeeDirectory.cancel'),
      save: messages('employeeDirectory.save'),
      saving: messages('employeeDirectory.saving'),
      saved: messages('employeeDirectory.saved'),
      failed: messages('employeeDirectory.failed'),
    }} />
  </PageShell>
}
