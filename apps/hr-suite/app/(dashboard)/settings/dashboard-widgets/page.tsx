import { redirect } from 'next/navigation'
import { LEGACY_DASHBOARD_SETTINGS_ROUTE } from '@/lib/insights/analysis-contract'

export default function LegacyDashboardWidgetSettingsPage() {
  redirect(LEGACY_DASHBOARD_SETTINGS_ROUTE)
}
