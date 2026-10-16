'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { buttonClasses } from '@/components/ui/button'

type Labels = {
  navTitle: string
  overview: string
  assessments: string
  team: string
  comparison: string
  roleExplorer: string
  goals: string
  reports: string
}

const routes: Array<{ href: string; key: keyof Omit<Labels, 'navTitle'>; permission: string }> = [
  { href: '/workforce/talent', key: 'overview', permission: 'talent:manager-read' },
  { href: '/workforce/talent/assessments', key: 'assessments', permission: 'talent-assessment:read' },
  { href: '/workforce/talent/team', key: 'team', permission: 'talent-team:read' },
  { href: '/workforce/talent/comparison', key: 'comparison', permission: 'talent-comparison:read' },
  { href: '/workforce/talent/role-explorer', key: 'roleExplorer', permission: 'talent-comparison:read' },
  { href: '/workforce/talent/goals', key: 'goals', permission: 'talent-goal:read' },
  { href: '/workforce/talent/reports', key: 'reports', permission: 'talent-report:read' },
]

export function TalentWorkforceNavigation({ labels, permissions }: { labels: Labels; permissions: readonly string[] }) {
  const pathname = usePathname()
  const visibleRoutes = routes.filter(({ permission }) => permissions.includes(permission))

  return <nav aria-label={labels.navTitle} className="flex flex-wrap gap-2">
    {visibleRoutes.map(({ href, key }) => {
      const active = pathname === href
      return <Link aria-current={active ? 'page' : undefined} className={buttonClasses({ size: 'sm', variant: active ? 'primary' : 'secondary' })} href={href} key={href}>{labels[key]}</Link>
    })}
  </nav>
}