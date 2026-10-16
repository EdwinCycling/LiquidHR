import type { ReactNode } from 'react'
import { TalentWorkforceNavigation } from '@/components/talent/talent-workforce-navigation'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'

export default async function WorkforceTalentLayout({ children }: { children: ReactNode }) {
  const [t, context] = await Promise.all([getTranslator('talent'), requireAuthContext()])
  return <>
    <div className="mx-auto w-full max-w-7xl px-5 pt-5 sm:px-8 lg:px-10">
      <TalentWorkforceNavigation permissions={context.permissions} labels={{ navTitle: t('startNavigationTitle'), overview: t('workforceTitle'), assessments: t('assessmentTitle'), team: t('teamMatrixTitle'), comparison: t('comparisonTitle'), roleExplorer: t('roleExplorerTitle'), goals: t('goalTitle'), reports: t('reportTitle') }} />
    </div>
    {children}
  </>
}