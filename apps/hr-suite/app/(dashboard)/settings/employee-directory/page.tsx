import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { EmployeeDirectorySettingsForm } from '@/components/settings/employee-directory-settings-form'
import { getEmployeeDirectorySettings } from '@/lib/employee-directory/service'
import { getTranslator } from '@/lib/i18n/server'

export default async function EmployeeDirectorySettingsPage() {
  const [settings, messages] = await Promise.all([getEmployeeDirectorySettings(), getTranslator('settings')])
  return <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10">
    <AdminSettingsPageHeader backLabel={messages('admin.backToOverview')} eyebrow={messages('admin.eyebrow')} title={messages('employeeDirectory.title')} subtitle={messages('employeeDirectory.subtitle')} />
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
      save: messages('employeeDirectory.save'),
      saving: messages('employeeDirectory.saving'),
      saved: messages('employeeDirectory.saved'),
      failed: messages('employeeDirectory.failed'),
    }} />
  </main>
}
