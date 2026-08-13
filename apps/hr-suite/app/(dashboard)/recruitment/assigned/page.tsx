import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { listAssignedRecruitmentApplications } from '@/lib/recruitment/guided-service'

export default async function AssignedRecruitmentPage() {
  try { await requireTenantModule('RECRUITMENT'); await requirePermission('recruitment-participation:read') } catch (error) {
    if (error instanceof ModuleError && error.status === 404) notFound()
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const [assignments, t] = await Promise.all([listAssignedRecruitmentApplications(), getTranslator('recruitment')])
  return <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-10"><p className="eyebrow">{t('guided.eyebrow')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('guided.openAssigned')}</h1><p className="mt-3 max-w-2xl text-muted-foreground">{t('guided.assignedDescription')}</p><section className="mt-8 rounded-2xl border bg-surface"><div className="border-b p-5"><h2 className="font-semibold">{t('guided.openAssigned')}</h2></div>{assignments.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{t('guided.noAssigned')}</p> : <div className="divide-y">{assignments.map((assignment) => <Link className="flex flex-col gap-2 p-5 transition hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between" href={`/recruitment/assigned/${assignment.applicationId}`} key={assignment.applicationId}><span><span className="block font-semibold">{assignment.candidateName}</span><span className="mt-1 block text-sm text-muted-foreground">{assignment.vacancyTitle}</span></span><span className="text-sm text-muted-foreground">{assignment.stageName ?? '—'}</span></Link>)}</div>}</section></main>
}
