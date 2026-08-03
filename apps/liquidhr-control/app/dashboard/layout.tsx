import { Sidebar } from '@/components/control/sidebar'
import { getControlSnapshot } from '@/lib/control/service'

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const snapshot = await getControlSnapshot()
  return <div className="min-h-screen"><Sidebar displayName={snapshot.operator.displayName} role={snapshot.operator.role} /><main className="lg:ml-64">{children}</main></div>
}
