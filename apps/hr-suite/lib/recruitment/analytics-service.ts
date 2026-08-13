interface VacancyInput { readonly id: string; readonly isOpen: boolean }
interface ApplicationInput { readonly vacancyId: string; readonly stage: string | null; readonly outcome: 'AFGEWEZEN' | 'AANGENOMEN' | null; readonly source: string; readonly receivedAt: string; readonly outcomeAt: string | null }

export function buildRecruitmentAnalytics(input: { readonly vacancies: readonly VacancyInput[]; readonly applications: readonly ApplicationInput[] }) {
  const activeApplications = input.applications.filter((application) => application.outcome === null).length
  const newApplications = input.applications.filter((application) => application.outcome === null && application.stage !== null).length
  const byVacancy = input.vacancies.map((vacancy) => {
    const applications = input.applications.filter((application) => application.vacancyId === vacancy.id)
    const source = applications.reduce<Record<string, number>>((result, application) => ({ ...result, [application.source]: (result[application.source] ?? 0) + 1 }), {})
    const status = applications.reduce<Record<string, number>>((result, application) => {
      const key = application.outcome ?? application.stage ?? 'ONBEKEND'
      return { ...result, [key]: (result[key] ?? 0) + 1 }
    }, {})
    const completed = applications.filter((application) => application.outcomeAt !== null)
    const timeToOutcomeDays = completed.length === 0 ? null : Math.round((completed.reduce((sum, application) => sum + (new Date(application.outcomeAt ?? application.receivedAt).getTime() - new Date(application.receivedAt).getTime()) / 86_400_000, 0) / completed.length) * 10) / 10
    return { vacancyId: vacancy.id, totalApplications: applications.length, newApplications: applications.filter((application) => application.outcome === null).length, rejected: applications.filter((application) => application.outcome === 'AFGEWEZEN').length, hired: applications.filter((application) => application.outcome === 'AANGENOMEN').length, source, status, timeToOutcomeDays }
  })
  return { global: { openVacancies: input.vacancies.filter((vacancy) => vacancy.isOpen).length, activeApplications, newApplications }, byVacancy }
}
