import { MenuOrderForm } from '@/components/settings/menu-order-form'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { getTranslator } from '@/lib/i18n/server'
import { PageShell } from '@/components/layout/page-shell'

export default async function MenuOrderPage() {
  const [navigation, settings] = await Promise.all([getTranslator('navigation'), getTranslator('settings')])
  const items = [
    { href: '/dashboard', label: navigation('dashboard') }, { href: '/dashboard/start', label: navigation('startPage') },
    { href: '/employees', label: navigation('employees') },
    { href: '/research', label: navigation('research') },
    { href: '/organization-chart', label: navigation('organizationChart') }, { href: '/hr-calendar', label: navigation('hrCalendar') },
    { href: '/insights', label: navigation('insights') }, { href: '/workforce', label: navigation('workforce') },
    { href: '/settings', label: navigation('settings') },
  ]
  return <PageShell className="py-8 lg:py-10"><AdminSettingsPageHeader backLabel={settings('admin.backToOverview')} eyebrow={settings('admin.sections.platform')} subtitle={settings('admin.menuOrderDescription')} title={settings('admin.menuOrderTitle')} /><MenuOrderForm cancelLabel={settings('admin.menuOrderCancel')} items={items} moveDownLabel={settings('admin.menuOrderMoveDown')} moveUpLabel={settings('admin.menuOrderMoveUp')} saveLabel={settings('admin.menuOrderSave')} savedLabel={settings('admin.menuOrderSaved')} /></PageShell>
}
