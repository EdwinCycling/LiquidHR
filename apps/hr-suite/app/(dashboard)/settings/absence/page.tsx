import { redirect } from 'next/navigation'
import { AuthorizationError } from '@/lib/auth/permissions'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AbsenceSettingsForm } from '@/components/settings/absence-settings-form'
import { AbsenceTaskTemplateManager } from '@/components/settings/absence-task-template-manager'
import { getAbsenceSettingsPageData } from '@/lib/absence/settings-service'
import { listAbsenceTaskTemplates } from '@/lib/absence/task-service'
import { getTranslator } from '@/lib/i18n/server'

export default async function AbsenceSettingsPage() {
  let data: Awaited<ReturnType<typeof getAbsenceSettingsPageData>>
  let t: Awaited<ReturnType<typeof getTranslator>>
  let taskTemplates: Awaited<ReturnType<typeof listAbsenceTaskTemplates>>
  try {
    ;[data, t] = await Promise.all([getAbsenceSettingsPageData(), getTranslator('settings')])
    taskTemplates = await listAbsenceTaskTemplates()
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <AdminSettingsPageHeader
        backLabel={t('admin.backToOverview')}
        eyebrow={t('admin.sections.hrSetup')}
        subtitle={t('absenceSettings.subtitle')}
        title={t('absenceSettings.title')}
      />
      <AbsenceSettingsForm
        caseManagers={data.caseManagers}
        defaultCaseManagerEmployeeId={data.defaultCaseManagerEmployeeId}
        employeeSelfReportEnabled={data.employeeSelfReportEnabled}
        frequentAbsenceThreshold={data.frequentAbsenceThreshold}
        labels={{
          threshold: t('absenceSettings.threshold'),
          thresholdHelp: t('absenceSettings.thresholdHelp'),
          caseManager: t('absenceSettings.caseManager'),
          caseManagerHelp: t('absenceSettings.caseManagerHelp'),
          noCaseManager: t('absenceSettings.noCaseManager'),
          save: t('absenceSettings.save'),
          saving: t('absenceSettings.saving'),
          saved: t('absenceSettings.saved'),
          failed: t('absenceSettings.failed'),
          invalid: t('absenceSettings.invalid'),
          employeeSelfReport: t('absenceSettings.title'),
          employeeSelfReportHelp: t('absenceSettings.subtitle'),
        }}
      />
      <AbsenceTaskTemplateManager
        labels={{
          title: t('absenceSettings.tasksTitle'),
          subtitle: t('absenceSettings.tasksSubtitle'),
          code: t('absenceSettings.taskCode'),
          taskTitle: t('absenceSettings.taskTitle'),
          description: t('absenceSettings.taskDescription'),
          dueDays: t('absenceSettings.taskDueDays'),
          evidenceRequired: t('absenceSettings.evidenceRequired'),
          evidenceCategory: t('absenceSettings.evidenceCategory'),
          add: t('absenceSettings.taskAdd'),
          saving: t('absenceSettings.taskSaving'),
          activate: t('absenceSettings.taskActivate'),
          deactivate: t('absenceSettings.taskDeactivate'),
          custom: t('absenceSettings.taskCustom'),
          system: t('absenceSettings.taskSystem'),
          empty: t('absenceSettings.tasksEmpty'),
          failed: t('absenceSettings.taskFailed'),
          codeConflict: t('absenceSettings.taskCodeConflict'),
        }}
        templates={taskTemplates}
      />
    </div>
  )
}
