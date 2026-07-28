import { MenuOrderForm } from '@/components/settings/menu-order-form'
import { getTranslator } from '@/lib/i18n/server'

export default async function MenuOrderPage() {
  const [navigation, settings] = await Promise.all([getTranslator('navigation'), getTranslator('settings')])
  const items = [
    { href: '/dashboard', label: navigation('dashboard') }, { href: '/dashboard/start', label: navigation('startPage') },
    { href: '/employees', label: navigation('employees') },
    { href: '/organization-chart', label: navigation('organizationChart') }, { href: '/hr-calendar', label: navigation('hrCalendar') },
    { href: '/insights', label: navigation('insights') }, { href: '/workforce', label: navigation('workforce') }, { href: '/settings', label: navigation('settings') },
  ]
  return <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10"><p className="eyebrow">{settings('admin.sections.platform')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{settings('admin.menuOrderTitle')}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{settings('admin.menuOrderDescription')}</p><MenuOrderForm items={items} moveDownLabel={settings('admin.menuOrderMoveDown')} moveUpLabel={settings('admin.menuOrderMoveUp')} saveLabel={settings('admin.menuOrderSave')} savedLabel={settings('admin.menuOrderSaved')} /></div>
}
