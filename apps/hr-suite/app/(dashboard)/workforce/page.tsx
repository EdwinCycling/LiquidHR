import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BriefcaseBusiness, Grid2X2, MessageSquareText, Sparkles, Star, Tags } from 'lucide-react'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'

export default async function WorkforcePage() {
  const authContext = await requireAuthContext()
  const canReadManagementWorkspace = authContext.permissions.includes('workforce:read')
  const canReadPersonalWorkspace = authContext.employeeId !== null && (
    authContext.permissions.includes('self:continuous-appraisal:read') || authContext.permissions.includes('self:talent:read')
  )
  if (!canReadManagementWorkspace && !canReadPersonalWorkspace) redirect('/geen-toegang')
  const personalOnly = !canReadManagementWorkspace

  const [t, star] = await Promise.all([getTranslator('workforce'), getTranslator('starPerformers')])
  const canReadStarPerformers = !personalOnly && authContext.permissions.includes('star-performer:read')
  const canReadTalentProfiles = personalOnly
    ? authContext.permissions.includes('self:talent:read')
    : authContext.permissions.includes('talent:manager-read')
  const canReadTalentReview = !personalOnly && authContext.permissions.includes('talent-review:read')
  const canReadContinuousAppraisal = personalOnly
    ? authContext.permissions.includes('self:continuous-appraisal:read')
    : authContext.permissions.includes('continuous-appraisal:read')

  const windows = [
    ...(canReadTalentReview ? [
      { icon: Grid2X2, title: t('gridNineTitle'), description: t('gridNineDescription'), href: '/workforce/9-grid', status: t('available'), footer: t('openWorkspace') },
    ] : []),
    ...(canReadContinuousAppraisal ? [{
      icon: MessageSquareText,
      title: t('performanceTalksTitle'),
      description: t('performanceTalksDescription'),
      href: personalOnly ? '/my-appraisal' : '/workforce/continuous-appraisal', status: t('available'), footer: t('openWorkspace'),
    }] : []),
    ...(canReadTalentProfiles ? [
      { icon: Sparkles, title: t('talentProfilesTitle'), description: t('talentProfilesDescription'), href: personalOnly ? '/my-talent' : '/workforce/talent', status: t('available'), footer: t('openWorkspace') },
    ] : []),
    ...(canReadStarPerformers ? [
      { icon: Star, title: star('title'), description: star('subtitle'), href: '/workforce/star-performers', status: t('available'), footer: t('openWorkspace') },
      { icon: Tags, title: star('tagsTitle'), description: star('tagsSubtitle'), href: '/workforce/star-performer-tags', status: t('available'), footer: t('openWorkspace') },
    ] : []),
  ]

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-primary/15 bg-primary p-6 text-primary-foreground shadow-[0_1.5rem_3rem_color-mix(in_srgb,var(--primary)_20%,transparent)] sm:p-8">
        <div aria-hidden="true" className="absolute -right-20 -top-24 size-72 rounded-full border border-primary-foreground/10 bg-primary-foreground/5 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10">
            <BriefcaseBusiness aria-hidden="true" size={23} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground/65">{personalOnly ? t('employeeEyebrow') : t('eyebrow')}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{personalOnly ? t('employeeTitle') : t('title')}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/75 sm:text-base">{personalOnly ? t('employeeSubtitle') : t('subtitle')}</p>
          </div>
        </div>
      </header>

      <section aria-labelledby="workforce-windows-title" className="mt-8">
        <h2 className="sr-only" id="workforce-windows-title">{t('title')}</h2>
        <div className="grid gap-5 lg:grid-cols-2">
          {windows.map(({ icon: Icon, title, description, href, status = t('workInProgress'), footer = t('comingSoon') }) => (
            <article className={`group min-h-64 rounded-[1.5rem] border ${href ? 'bg-surface' : 'border-dashed border-primary/25 bg-surface'} p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md sm:p-7`} key={title}>
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-12 place-items-center rounded-2xl bg-accent text-primary">
                  <Icon aria-hidden="true" size={22} />
                </span>
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">{status}</span>
              </div>
              <h3 className="mt-8 text-xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
              {href ? <Link className="mt-8 inline-flex text-sm font-semibold text-primary hover:underline" href={href}>{footer} →</Link> : <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{footer}</p>}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
