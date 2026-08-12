import { notFound, redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TemplateDesigner } from '@/components/journeys/template-designer'
import { AuthorizationError, requireAnyPermission, requirePermission } from '@/lib/auth/permissions'
import { journeyTemplates, JourneyTemplateServiceError } from '@/lib/journeys'
import { getLocale } from '@/lib/i18n/server'
import { getJourneyLabels } from '@/lib/journeys/labels'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'

async function allowed(permission: string): Promise<boolean> {
  try { await requirePermission(permission); return true }
  catch (error) { if (error instanceof AuthorizationError) return false; throw error }
}

export default async function JourneyTemplateDesignerPage({ params }: { params: Promise<{ templateId: string }> }) {
  let auth
  try {
    auth = await requireAnyPermission(['journey-template:read', 'journey-template:write', 'journey-template:publish'])
    await requireTenantModule('JOURNEYS')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    redirect('/settings/modules')
  }
  const { templateId } = await params
  let template
  try { template = await journeyTemplates.getTemplate(templateId) }
  catch (error) { if (error instanceof JourneyTemplateServiceError && error.status === 404) notFound(); throw error }
  const supabase = await createClient()
  const [labels, locale, canWrite, canPublish, employees, managementRoles] = await Promise.all([
    getJourneyLabels(),
    getLocale(),
    allowed('journey-template:write'),
    allowed('journey-template:publish'),
    supabase.from('employees').select('id,first_name,birth_name,employee_number').eq('tenant_id', auth.tenantId).eq('hr_group_id', auth.hrGroupId!).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).order('first_name').limit(500),
    supabase.from('management_roles').select('code,name').eq('is_active', true).is('deleted_at', null).order('name').limit(250),
  ])
  return <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10"><AdminSettingsPageHeader backHref="/settings/journeys" backLabel={labels.backToCatalog} eyebrow={labels.eyebrow} subtitle={labels.designerSubtitle} title={`${labels.designerTitle} · ${template.draft.name.nl}`} /><TemplateDesigner canPublish={canPublish} canWrite={canWrite} employeeOptions={(employees.data ?? []).map((employee) => ({ id: employee.id, label: `${employee.first_name} ${employee.birth_name} · ${employee.employee_number}` }))} labels={labels} locale={locale} managementRoleOptions={(managementRoles.data ?? []).map((role) => ({ code: role.code, label: role.name }))} template={template} /></div>
}
