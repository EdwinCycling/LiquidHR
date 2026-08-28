import { MenuOrderForm } from '@/components/settings/menu-order-form'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { getTranslator } from '@/lib/i18n/server'
import { PageShell } from '@/components/layout/page-shell'
import { SIDEBAR_SECTION_DEFINITIONS } from '@/components/layout/sidebar-navigation'

export default async function MenuOrderPage() {
  const [navigation, settings] = await Promise.all([getTranslator('navigation'), getTranslator('settings')])
  const labels = {
    daily: navigation('sectionDaily'),
    peopleOrganization: navigation('sectionPeopleOrganization'),
    hrProcesses: navigation('sectionHrProcesses'),
    steering: navigation('sectionSteering'),
    management: navigation('sectionManagement'),
  }
  const itemLabels: Record<string, string> = {
    '/dashboard/start': navigation('startPage'), '/work': navigation('work'), '/hr-calendar': navigation('hrCalendar'),
    '/employees': navigation('employees'), '/organization-chart': navigation('organizationChart'), '/workforce': navigation('workforce'),
    '/recruitment': navigation('recruitment'), '/journeys': navigation('journeys'), '/research': navigation('research'),
    '/insights': navigation('insights'), '/settings': navigation('settings'),
  }
  const sections = SIDEBAR_SECTION_DEFINITIONS.map((section) => ({ id: section.id, label: labels[section.id], items: section.hrefs.map((href) => ({ href, label: itemLabels[href] ?? href })) }))
  return <PageShell className="py-8 lg:py-10"><AdminSettingsPageHeader backLabel={settings('admin.backToOverview')} eyebrow={settings('admin.sections.platform')} subtitle={settings('admin.menuOrderDescription')} title={settings('admin.menuOrderTitle')} /><MenuOrderForm cancelLabel={settings('admin.menuOrderCancel')} moveDownLabel={settings('admin.menuOrderMoveDown')} moveUpLabel={settings('admin.menuOrderMoveUp')} saveLabel={settings('admin.menuOrderSave')} savedLabel={settings('admin.menuOrderSaved')} sections={sections} /></PageShell>
}
