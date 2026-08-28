import { redirect } from 'next/navigation'
import { LEGACY_DASHBOARD_ROUTE } from '@/lib/insights/analysis-contract'

export default function LegacyDashboardPage() {
  redirect(LEGACY_DASHBOARD_ROUTE)
}
