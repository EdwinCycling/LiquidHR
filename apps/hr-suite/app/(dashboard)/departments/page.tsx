import { redirect } from 'next/navigation'
import { DepartmentManagement, type DepartmentManagerLabels } from '@/components/organization/department-management'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError, getRequestAuthorizationContext, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import type { DepartmentRecord } from '@/lib/organization/department-tree'
import { createClient } from '@/lib/supabase/server'

export default async function DepartmentsPage() {
  let departments: DepartmentRecord[]
  try {
    departments = await loadDepartments()
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [translate, settingsTranslate] = await Promise.all([getTranslator('departments'), getTranslator('settings')])
  let canWrite = true
  try {
    await requirePermission('department:write')
  } catch (error) {
    if (error instanceof AuthorizationError) canWrite = false
    else throw error
  }
  const canStartProcess = (await getRequestAuthorizationContext()).context.permissions.includes('process-instance:start')
  const labels: DepartmentManagerLabels = {
    add: translate('add'),
    edit: translate('edit'),
    create: translate('create'),
    save: translate('save'),
    cancel: translate('cancel'),
    close: translate('close'),
    code: translate('codeLabel'),
    codeReadOnly: translate('codeReadOnly'),
    name: translate('name'),
    description: translate('description'),
    descriptionHelp: translate('descriptionHelp'),
    parent: translate('parent'),
    parentHelp: translate('parentHelp'),
    noParent: translate('noParent'),
    structure: translate('structure'),
    search: translate('search'),
    filter: translate('filter'),
    allStatuses: translate('allStatuses'),
    activeOnly: translate('activeOnly'),
    inactiveOnly: translate('inactiveOnly'),
    sort: translate('sort'),
    sortName: translate('sortName'),
    sortCode: translate('sortCode'),
    results: translate('results'),
    resetFilters: translate('resetFilters'),
    actions: translate('actions'),
    active: translate('active'),
    inactive: translate('inactive'),
    noResults: translate('noResults'),
    empty: translate('empty'),
    readOnly: translate('readOnly'),
    failed: translate('failed'),
    conflict: translate('conflict'),
    saved: translate('saved'),
    processStart: translate('processStart'),
    discardTitle: translate('discardTitle'),
    discardDescription: translate('discardDescription'),
    discardConfirm: translate('discardConfirm'),
    discardCancel: translate('discardCancel'),
    deactivate: translate('deactivate'),
    activate: translate('activate'),
    deactivateTitle: translate('deactivateTitle'),
    activateTitle: translate('activateTitle'),
    deactivateDescription: translate('deactivateDescription'),
    activateDescription: translate('activateDescription'),
    confirmDeactivate: translate('confirmDeactivate'),
    confirmActivate: translate('confirmActivate'),
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <AdminSettingsPageHeader backLabel={settingsTranslate('admin.backToOverview')} eyebrow={translate('eyebrow')} subtitle={translate('subtitle')} title={translate('title')} />
      <DepartmentManagement canStartProcess={canStartProcess} canWrite={canWrite} departments={departments} labels={labels} />
    </section>
  )
}

async function loadDepartments(): Promise<DepartmentRecord[]> {
  const context = await requirePermission('department:read')
  const groupId = requireHrGroupId(context)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('departments')
    .select('id, code, name, description, parent_id, is_active')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', groupId)
    .order('name')
    .limit(500)

  if (error) throw error
  return data.map((department) => ({
    id: department.id,
    code: department.code,
    name: department.name,
    description: department.description,
    parentId: department.parent_id,
    isActive: department.is_active,
  }))
}
