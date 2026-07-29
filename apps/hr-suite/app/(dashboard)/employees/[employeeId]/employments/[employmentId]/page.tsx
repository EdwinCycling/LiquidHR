/* eslint-disable @next/next/no-img-element -- private avatar routes and signed tenant URLs must render directly without image optimization. */
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  UserRound,
} from "lucide-react";
import { EmploymentMutationPanel } from "@/components/employment/employment-mutation-panel";
import { EmploymentTimeMap } from "@/components/employment/employment-time-map";
import { EmploymentContractTimeline } from "@/components/employment/employment-contract-timeline";
import { SelectableTimelineList } from "@/components/employment/selectable-timeline-list";
import { OrganizationTimelineManager } from "@/components/employment/organization-timeline-manager";
import { WorkPatternPanel } from "@/components/employment/work-pattern-panel";
import {
  EmploymentDetailError,
  getEmploymentDetail,
} from "@/lib/employment/employment-detail-service";
import { getLocale, getTranslator } from "@/lib/i18n/server";
import { getUserPreferences } from "@/lib/preferences/server";
import { formatDate, formatDateTime } from "@/lib/preferences/formatters";
import { seniorityDuration } from "@/lib/employment/seniority";
import type { DateFormat } from "@/lib/preferences/user-preferences";
import { listEmployeeHrEvents } from "@/lib/hr-events/service";

interface PageProps {
  params: Promise<{ employeeId: string; employmentId: string }>;
  searchParams: Promise<{ tab?: string; view?: string; date?: string; fromTab?: string }>;
}

const tabs = [
  "overview",
  "schedule",
  "salary",
  "organization",
  "costs",
  "history",
] as const;
type Tab = (typeof tabs)[number];

function periodLabel(
  from: string,
  until: string | null,
  locale: string,
  dateFormat: DateFormat,
  open: string,
) {
  const format = (value: string) =>
    formatDate(value, { locale, dateFormat });
  return `${format(from)} — ${until ? format(until) : open}`;
}

function DataCard({
  title,
  value,
  meta,
}: {
  title: string;
  value: string;
  meta?: string;
}) {
  return (
    <article className="rounded-xl border bg-surface p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-2 font-semibold">{value}</p>
      {meta && <p className="mt-1 text-sm text-muted-foreground">{meta}</p>}
    </article>
  );
}

async function loadPageData(employeeId: string, employmentId: string, tab: Tab) {
  try {
    return await Promise.all([
      getEmploymentDetail(employeeId, employmentId, tab),
      getLocale(),
      getUserPreferences(),
      getTranslator("employment"),
      tab === "history" ? listEmployeeHrEvents(employeeId, { employmentId }) : Promise.resolve([]),
    ]);
  } catch (error) {
    if (error instanceof EmploymentDetailError && error.status === 404)
      notFound();
    throw error;
  }
}

export default async function EmploymentDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ employeeId, employmentId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const tab: Tab = tabs.includes(query.tab as Tab)
    ? (query.tab as Tab)
    : "overview";
  const [detail, locale, preferences, t, events] = await loadPageData(
    employeeId,
    employmentId,
    tab,
  );
  const expanded = query.view !== "compact";
  const today = new Date().toISOString().slice(0, 10);
  const seniority = seniorityDuration(detail.employment.seniority_date, today);
  const currentContract = detail.contracts.find((contract) => contract.starts_on <= today && (!contract.ends_on || contract.ends_on >= today)) ?? detail.contracts[0];
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "")
    ? query.date!
    : today;
  const name = `${detail.employee.first_name} ${detail.employee.birth_name}`;
  const mutationLabels = Object.fromEntries(
    [
      "change",
      "rollback",
      "onlyBlockProtected",
      "effectiveOn",
      "conditionGroup",
      "scheduleType",
      "averageHours",
      "averageDays",
      "partTimeFactor",
      "startWeek",
      "timeForTime",
      "hoursAndAverageDays",
      "hoursPerDay",
      "hoursAndSpecificDays",
      "timesPerDay",
      "paymentType",
      "periodicFixed",
      "hourlyVariable",
      "paymentFrequency",
      "monthly",
      "fourWeekly",
      "fulltimeAmount",
      "hourlyRate",
      "costCenter",
      "costCarrier",
      "percentage",
      "addAllocation",
      "allocationTotal",
      "allocationMustBe100",
      "changeReason",
      "continue",
      "changeSaved",
      "changeFailed",
      "rollbackReason",
      "twkTitle",
      "twkWarning",
      "normalConfirmTitle",
      "normalConfirmText",
      "confirm",
      "cancel",
      "rollbackTitle",
      "rollbackWarning",
      "rollbackConfirm",
      "impactTitle",
      "impactDirect",
      "impactNotApplicable",
      "impactScheduleSalary",
      "impactScheduleLeave",
      "impactSchedulePension",
      "impactSchedulePayroll",
      "impactSalaryOrganization",
      "impactSalaryLabor",
      "impactSalaryPayroll",
      "impactLaborSchedule",
      "impactLaborSalary",
      "impactLaborLeave",
    ].map((key) => [key, t(key)]),
  );
  const tabLabels: Record<Tab, string> = {
    overview: t("tabsOverview"),
    schedule: t("tabsSchedule"),
    salary: t("tabsSalary"),
    organization: t("tabsOrganization"),
    costs: t("tabsCosts"),
    history: t("tabsHistory"),
  };
  const effectiveStatus =
    detail.employment.starts_on > today
      ? t("future")
      : detail.employment.ends_on && detail.employment.ends_on < today
        ? t("ended")
        : t("active");
  const contractTypeLabel = detail.employment.contract_type === 'INDEFINITE' ? t('indefinite') : t('definite');
  const workerTypeLabel = currentContract?.worker_type === 'EMPLOYEE'
    ? t('workerEmployee')
    : currentContract?.worker_type === 'STUDENT_INTERN'
      ? t('workerStudentIntern')
      : currentContract?.worker_type === 'TEMPORARY_AGENCY'
        ? t('workerTemporaryAgency')
        : currentContract?.worker_type === 'EXTERNAL_NO_PAYROLL'
          ? t('workerExternal')
          : t('notRecorded');
  const timelineListLabels = {
    current: t("currentValue"),
    history: t("historyLabel"),
    empty: t("notRecorded"),
    close: t("cancel"),
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <Link
        href={`/employees/${employeeId}?tab=${query.fromTab === 'overview' ? 'overview' : query.fromTab === 'personal' ? 'personal' : query.fromTab === 'reminders' ? 'reminders' : 'employments'}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToEmployee")}
      </Link>
      <header className={`relative mt-4 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary via-primary to-accent-foreground text-primary-foreground shadow-lg ${expanded ? 'p-5 sm:p-7' : 'p-2.5'}`}>
        <div
          aria-hidden="true"
          className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-accent opacity-80"
        />
        <div className={`relative flex items-center justify-between ${expanded ? 'flex-col gap-6 lg:flex-row lg:items-center' : 'gap-3'}`}>
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            {detail.employee.avatar_url ? (
              <img
                src={detail.employee.avatar_url}
                alt={name}
                className={`${expanded ? 'h-16 w-16 sm:h-20 sm:w-20' : 'h-8 w-8 rounded-lg'} rounded-2xl object-cover ${expanded ? 'ring-4 ring-background' : ''}`}
              />
            ) : (
              <span className={`grid shrink-0 place-items-center rounded-2xl bg-primary font-bold text-primary-foreground ${expanded ? 'h-16 w-16 text-xl sm:h-20 sm:w-20' : 'h-8 w-8 rounded-lg text-[0.65rem]'}`}>
                {detail.employee.first_name[0]}
                {detail.employee.birth_name[0]}
              </span>
            )}
            <div className="min-w-0">
              {expanded && <p className="eyebrow text-primary-foreground/70">
                {detail.employee.employee_number} ·{" "}
                {detail.employment.employment_number}
              </p>}
              <h1 className={`${expanded ? 'mt-1 text-2xl sm:text-3xl' : 'text-base'} truncate font-semibold tracking-tight`}>{name}</h1>
              {expanded && <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-primary-foreground/80">
                <span className="inline-flex items-center gap-1.5">
                  <BriefcaseBusiness className="h-4 w-4" />
                  {contractTypeLabel}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {detail.administration.name}
                </span>
              </p>}
            </div>
          </div>
          <div className="relative flex flex-wrap items-center gap-2">
            {expanded && <>
              <span className="status-chip bg-success-surface text-success">{t("employmentContext")}</span>
              <span className="status-chip bg-accent text-accent-foreground">{effectiveStatus}</span>
              <span className="status-chip bg-primary-foreground/15 text-primary-foreground">
                <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
                {workerTypeLabel}
              </span>
            </>}
            <Link
              prefetch={false}
              className="button-secondary border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
              href={`?tab=${tab}&view=${expanded ? "compact" : "expanded"}`}
            >
              {expanded ? t("compact") : t("expanded")}
            </Link>
          </div>
        </div>
        {expanded && (
          <div className="relative mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-primary-foreground/20 pt-4 text-sm text-primary-foreground/80">
            {detail.employee.work_email && (
              <a
                href={`mailto:${detail.employee.work_email}`}
                className="inline-flex items-center gap-2 hover:text-primary-foreground"
              >
                <Mail className="h-4 w-4" />
                {detail.employee.work_email}
              </a>
            )}
            {(detail.employee.work_phone ?? detail.employee.work_mobile) && (
              <a
                href={`tel:${detail.employee.work_phone ?? detail.employee.work_mobile}`}
                className="inline-flex items-center gap-2 hover:text-primary-foreground"
              >
                <Phone className="h-4 w-4" />
                {detail.employee.work_phone ?? detail.employee.work_mobile}
              </a>
            )}
          </div>
        )}
      </header>

      <nav
        aria-label={t("detailTitle", {
          number: detail.employment.employment_number,
        })}
        className="mt-5 overflow-x-auto rounded-2xl border bg-surface p-1.5 shadow-sm"
      >
        <div className="flex min-w-max gap-1">
          {tabs.map((item) => (
            <Link
              prefetch={false}
              key={item}
              href={`?tab=${item}&view=${expanded ? "expanded" : "compact"}`}
              className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === item ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {tabLabels[item]}
            </Link>
          ))}
        </div>
      </nav>

      <div className="mt-6">
        {tab === "overview" && (
          <div className="space-y-5">
            <section className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <DataCard
                  title={t("employmentNumber")}
                  value={detail.employment.employment_number}
                />
                <DataCard
                  title={t("startDate")}
                  value={periodLabel(
                    detail.employment.starts_on,
                    detail.employment.ends_on,
                    locale,
                    preferences.dateFormat,
                    t("active"),
                  )}
                />
                <DataCard title={t("seniorityDate")} value={detail.employment.seniority_date} meta={seniority ? t("seniorityDuration", { years: seniority.years, months: seniority.months }) : t("notRecorded")} />
                <DataCard title={t("country")} value={detail.employment.country_code} />
                <DataCard
                  title={t("incomeRelationshipNumber")}
                  value={String(detail.incomeRelationships[0]?.income_relationships?.ikv_number ?? t("notRecorded"))}
                />
                <DataCard title={t("laborConditions")} value={currentContract?.labor_condition_sets?.name ?? t("notRecorded")} />
                <DataCard title={t("workerType")} value={currentContract?.worker_type === "EMPLOYEE" ? t("workerEmployee") : currentContract?.worker_type === "STUDENT_INTERN" ? t("workerStudentIntern") : currentContract?.worker_type === "TEMPORARY_AGENCY" ? t("workerTemporaryAgency") : currentContract?.worker_type === "EXTERNAL_NO_PAYROLL" ? t("workerExternal") : t("notRecorded")} />
              </div>
            </section>
            <EmploymentContractTimeline
              employmentId={employmentId}
              canWrite={detail.capabilities.canWriteContract}
              contracts={detail.contracts.map((contract) => ({
                id: contract.id,
                sequenceNumber: contract.sequence_number,
                workerType: contract.worker_type,
                flexPhaseId: contract.flex_phase_id,
                flexPhaseName: contract.flex_phases?.name ?? null,
                laborConditionSetId: contract.labor_condition_set_id,
                laborConditionName: contract.labor_condition_sets?.name ?? t("notRecorded"),
                durationType: contract.duration_type,
                startsOn: contract.starts_on,
                endsOn: contract.ends_on,
                probationApplies: contract.probation_applies,
                probationEndsOn: contract.probation_ends_on,
              }))}
              options={{
                laborConditionSets: [...detail.options.laborConditionSets],
                flexPhases: [...detail.options.flexPhases],
              }}
              labels={{
                title: t("contractsTitle"), add: t("contractAdd"), edit: t("change"),
                close: t("cancel"), save: t("confirm"), cancel: t("cancel"),
                workerType: t("workerType"), flexPhase: t("flexPhase"),
                laborConditions: t("laborConditions"), duration: t("duration"),
                startDate: t("startDate"), endDate: t("endsOn"),
                probation: t("probation"), probationEnd: t("probationEnd"),
                indefinite: t("indefinite"), definite: t("definite"),
                yes: t("yes"), no: t("no"), workerEmployee: t("workerEmployee"),
                workerStudentIntern: t("workerStudentIntern"),
                workerTemporaryAgency: t("workerTemporaryAgency"),
                workerExternal: t("workerExternal"), active: t("active"),
                failed: t("changeFailed"), addBlocked: t("contractAddBlocked"),
              }}
            />
            <article className="rounded-2xl border bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Sparkles className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-semibold">{t("aiSummary")}</h2>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
                {t("aiSummaryPlaceholder")}
              </p>
            </article>
          </div>
        )}
        {tab === "schedule" && (
          <div className="space-y-6">
            <SelectableTimelineList
              labels={timelineListLabels}
              items={detail.schedules.map((row) => ({
                id: row.id,
                title: `${row.average_hours_per_week} ${t("weeklyHours")}`,
                period: periodLabel(row.valid_from, row.valid_until, locale, preferences.dateFormat, t("active")),
                summary: `${row.average_days_per_week} ${t("averageDays")} · ${Math.round(Number(row.part_time_factor) * 100)}%`,
                details: [
                  { label: t("scheduleType"), value: row.schedule_type },
                  { label: t("weeklyHours"), value: String(row.average_hours_per_week) },
                  { label: t("partTimeFactor"), value: `${Math.round(Number(row.part_time_factor) * 100)}%` },
                  { label: t("onCallEmployee"), value: row.is_on_call ? t("yes") : t("no") },
                ],
              }))}
            />
            <WorkPatternPanel
              employmentId={employmentId}
              canWrite={detail.capabilities.canWriteWorkSchedule}
              agreements={detail.schedules.map((row) => ({
                validFrom: row.valid_from,
                validUntil: row.valid_until,
                averageHours: Number(row.average_hours_per_week),
                dailyHours: [
                  row.monday_hours,
                  row.tuesday_hours,
                  row.wednesday_hours,
                  row.thursday_hours,
                  row.friday_hours,
                  row.saturday_hours,
                  row.sunday_hours,
                ].map((value) => Number(value ?? 0)),
              }))}
              labels={{
                hoursTimeline: t("workPatternHoursTimeline"),
                patternTimeline: t("workPatternTimeline"),
                noPatterns: t("workPatternNoPatterns"),
                newPattern: t("workPatternNew"),
                patternName: t("workPatternName"),
                cycleWeeks: t("workPatternCycleWeeks"),
                week: t("workPatternWeek"),
                anchorDate: t("workPatternAnchorDate"),
                validFrom: t("validFrom"),
                validUntil: t("validUntil"),
                workingDay: t("workPatternWorkingDay"),
                startTime: t("workPatternStartTime"),
                endTime: t("workPatternEndTime"),
                breakMinutes: t("workPatternBreakMinutes"),
                averageHours: t("averageHours"),
                publishPattern: t("workPatternPublish"),
                saving: t("saving"),
                saved: t("workPatternSaved"),
                failed: t("workPatternFailed"),
                correlationHelp: t("workPatternCorrelationHelp"),
                days: [
                  t("dayMonday"),
                  t("dayTuesday"),
                  t("dayWednesday"),
                  t("dayThursday"),
                  t("dayFriday"),
                  t("daySaturday"),
                  t("daySunday"),
                ],
              }}
            />
            <EmploymentMutationPanel
              employmentId={employmentId}
              timeline="SCHEDULE"
              canWrite={detail.capabilities.canWriteContract}
              blockCount={detail.schedules.length}
              latestEffectiveOn={detail.schedules[0]?.valid_from}
              labels={mutationLabels}
            />
          </div>
        )}
        {tab === "salary" && !detail.capabilities.canReadSalary && (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            {t("salaryRestricted")}
          </div>
        )}
        {tab === "salary" && detail.capabilities.canReadSalary && (
          <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
            <SelectableTimelineList
              labels={timelineListLabels}
              items={detail.salaries.map((row) => ({
                id: row.id,
                title: new Intl.NumberFormat(locale, {
                    style: "currency",
                    currency: row.currency_code,
                }).format(row.parttime_amount ?? row.fulltime_amount ?? row.hourly_rate ?? 0),
                period: periodLabel(row.valid_from, row.valid_until, locale, preferences.dateFormat, t("active")),
                summary: `${row.salary_basis} · ${row.payment_frequency}`,
                details: [
                  { label: t("salaryCalculation"), value: row.salary_basis },
                  { label: t("fulltimeSalary"), value: String(row.fulltime_amount ?? "—") },
                  { label: t("parttimeSalary"), value: String(row.parttime_amount ?? "—") },
                  { label: t("frequency"), value: row.payment_frequency },
                ],
              }))}
            />
            <EmploymentMutationPanel
              employmentId={employmentId}
              timeline="SALARY"
              canWrite={detail.capabilities.canWriteSalary}
              blockCount={detail.salaries.length}
              latestEffectiveOn={detail.salaries[0]?.valid_from}
              labels={mutationLabels}
            />
          </div>
        )}
        {tab === "organization" && (
          <OrganizationTimelineManager
            employmentId={employmentId}
            canWrite={detail.capabilities.canWriteOrganization}
            placements={detail.organizations.map((row) => ({
              id: row.id,
              departmentId: row.department_id,
              departmentName: `${row.departments?.code ?? ""} · ${row.departments?.name ?? t("notRecorded")}`,
              jobId: row.job_id,
              jobName: row.job_title ?? t("notRecorded"),
              effectiveFrom: row.effective_from,
              effectiveTo: row.effective_to,
            }))}
            options={{
              departments: [...detail.options.departments],
              jobs: [...detail.options.jobs],
            }}
            labels={{
              current: t("currentValue"), history: t("historyLabel"),
              add: t("timelineAdd"), edit: t("change"), save: t("confirm"),
              cancel: t("cancel"), department: t("department"), job: t("job"),
              effectiveOn: t("effectiveOn"), active: t("active"), failed: t("changeFailed"),
            }}
          />
        )}
        {tab === "costs" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
            <SelectableTimelineList
              labels={timelineListLabels}
              items={detail.costAllocations.map((row) => ({
                id: row.id,
                title: `${row.cost_centers?.code ?? ""} · ${row.cost_centers?.name ?? t("costCenter")}`,
                period: periodLabel(row.valid_from, row.valid_until, locale, preferences.dateFormat, t("active")),
                summary: `${row.percentage}% · ${row.cost_carriers?.name ?? t("costCarrier")}`,
                details: [
                  { label: t("costCenter"), value: row.cost_centers?.name ?? t("notRecorded") },
                  { label: t("costCarrier"), value: row.cost_carriers?.name ?? t("notRecorded") },
                  { label: t("percentage"), value: `${row.percentage}%` },
                  { label: t("startDate"), value: row.valid_from },
                ],
              }))}
            />
            <EmploymentMutationPanel
              employmentId={employmentId}
              timeline="COST_ALLOCATION"
              canWrite={detail.capabilities.canWriteContract}
              blockCount={
                new Set(detail.costAllocations.map((row) => row.valid_from))
                  .size
              }
              latestEffectiveOn={detail.costAllocations[0]?.valid_from}
              costCenters={detail.options.costCenters}
              costCarriers={detail.options.costCarriers}
              labels={mutationLabels}
            />
          </div>
        )}
        {tab === "history" && (
          <div className="space-y-5">
            <EmploymentTimeMap
              events={events}
              selectedDate={selectedDate}
              labels={{
                title: t("timeMapTitle"),
                subtitle: t("timeMapSubtitle"),
                empty: t("timeMapEmpty"),
                asOf: t("timeMapAsOf"),
                lanes: {
                  contract: t("timeLaneContract"),
                  organization: t("timeLaneOrganization"),
                  conditions: t("timeLaneConditions"),
                  compensation: t("timeLaneCompensation"),
                  dossier: t("timeLaneDossier"),
                },
                events: {
                  EMPLOYMENT_STARTED: t("eventEmploymentStarted"),
                  EMPLOYMENT_ENDED: t("eventEmploymentEnded"),
                  INCOME_RELATIONSHIP_CHANGED: t("eventIncomeRelationship"),
                  ORGANIZATION_CHANGED: t("eventOrganization"),
                  LABOR_CONDITIONS_CHANGED: t("eventLabor"),
                  SCHEDULE_CHANGED: t("eventSchedule"),
                  SALARY_CHANGED: t("eventSalary"),
                  COST_ALLOCATION_CHANGED: t("eventCost"),
                  DOCUMENT_ADDED: t("eventDocumentAdded"),
                  DOCUMENT_EXPIRES: t("eventDocumentExpires"),
                },
              }}
            />
            <section className="rounded-2xl border bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-semibold">{t("auditLog")}</h2>
              {detail.auditLogs.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {t("auditEmpty")}
                </p>
              ) : (
                <ol className="mt-5 space-y-4 border-l pl-5">
                  {detail.auditLogs.map((log) => (
                    <li
                      key={log.id}
                      className="relative before:absolute before:-left-[1.6rem] before:top-1 before:h-3 before:w-3 before:rounded-full before:bg-primary"
                    >
                      <p className="font-semibold">
                        {log.action} · {log.entity_name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                        {formatDateTime(log.created_at, { locale, dateFormat: preferences.dateFormat, timeFormat: preferences.timeFormat })}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
