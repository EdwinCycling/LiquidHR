/* eslint-disable @next/next/no-img-element -- private avatar routes and signed tenant URLs must render directly without image optimization. */
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { EmploymentMutationPanel } from "@/components/employment/employment-mutation-panel";
import { EmploymentTimeMap } from "@/components/employment/employment-time-map";
import { EmploymentContractTimeline } from "@/components/employment/employment-contract-timeline";
import { SelectableTimelineList } from "@/components/employment/selectable-timeline-list";
import { OrganizationTimelineManager } from "@/components/employment/organization-timeline-manager";
import { CompanyLocationTimelineManager } from "@/components/employment/company-location-timeline-manager";
import { WorkPatternPanel } from "@/components/employment/work-pattern-panel";
import { EmploymentOverviewActions } from "@/components/employment/employment-overview-actions";
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
import { getRequestAuthorizationContext } from "@/lib/auth/permissions";
import { listProcessWork } from "@/lib/process-automation/work-service";

interface PageProps {
  params: Promise<{ employeeId: string; employmentId: string }>;
  searchParams: Promise<{ tab?: string; view?: string; date?: string; fromTab?: string }>;
}

const tabs = [
  "overview",
  "schedule",
  "salary",
  "organization",
  "company-location",
  "costs",
  "processes",
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

async function loadPageData(employeeId: string, employmentId: string, tab: Tab) {
  try {
    return await Promise.all([
      getEmploymentDetail(employeeId, employmentId, tab === "processes" ? "overview" : tab),
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
  const authContext = (await getRequestAuthorizationContext()).context;
  const canReadProcesses = authContext.permissions.includes('process-instance:read') || (authContext.permissions.includes('self:process-instance:read') && authContext.employeeId === employeeId);
  const requestedTab: Tab = tabs.includes(query.tab as Tab)
    ? (query.tab as Tab)
    : "overview";
  const tab: Tab = requestedTab === 'processes' && !canReadProcesses ? 'overview' : requestedTab;
  const [detail, locale, preferences, t, events] = await loadPageData(
    employeeId,
    employmentId,
    tab,
  );
  const tProcess = await getTranslator('processAutomation');
  const processWork = tab === 'processes' && canReadProcesses
    ? await listProcessWork({ subjectEmploymentId: employmentId, administrationId: detail.administration.id, tab: 'ALL', language: locale }).catch(() => null)
    : null;
  const expanded = query.view !== "compact";
  const today = new Date().toISOString().slice(0, 10);
  const seniority = seniorityDuration(detail.employment.seniority_date, today);
  const currentContract = detail.contracts.find((contract) => contract.starts_on <= today && (!contract.ends_on || contract.ends_on >= today));
  const currentSchedule = detail.schedules.find((schedule) => schedule.valid_from <= today && (!schedule.valid_until || schedule.valid_until >= today));
  const currentOrganization = detail.organizations.find((organization) => organization.effective_from <= today && (!organization.effective_to || organization.effective_to >= today));
  const contractHours = currentSchedule?.average_hours_per_week ?? currentContract?.fulltime_hours_per_week ?? null;
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
      "fulltimeReference",
      "partTimeFactor",
      "factorCalculated",
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
    "company-location": t("tabsCompanyLocation"),
    costs: t("tabsCosts"),
    processes: tProcess("processesTab"),
    history: t("tabsHistory"),
  };
  const effectiveStatus =
    detail.employment.starts_on > today
      ? t("future")
      : detail.employment.ends_on && detail.employment.ends_on < today
        ? t("ended")
        : t("active");
  const contractTypeLabel = currentContract?.duration_type === 'INDEFINITE' ? t('indefinite') : currentContract?.duration_type === 'DEFINITE' ? t('definite') : currentContract?.duration_type === 'TEMPORARY_NO_END' ? t('temporaryWithoutEnd') : t('notRecorded');
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
          {tabs.filter((item) => item !== 'processes' || canReadProcesses).map((item) => (
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
        {tab === "processes" && canReadProcesses && (
          <section className="space-y-5">
            <header>
              <p className="eyebrow text-primary">{tProcess('processesTab')}</p>
              <h2 className="mt-1 text-2xl font-semibold">{tProcess('workspaceTitle')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{tProcess('workspaceDescription')}</p>
            </header>
            {!processWork ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{tProcess('readError')}</p> : processWork.items.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground" role="status">{tProcess('noItems')}</p> : <div className="grid gap-4">{processWork.items.map((item) => {
              const status = item.instanceStatus === 'BLOCKED' ? 'BLOCKED' : item.status;
              const statusLabel = ({ OPEN: tProcess('statusOpen'), CLAIMED: tProcess('statusClaimed'), BLOCKED: tProcess('statusBlocked'), COMPLETED: tProcess('statusCompleted'), CANCELLED: tProcess('statusCancelled'), EXPIRED: tProcess('statusExpired') } as Record<string, string>)[status] ?? tProcess('unknown');
              return <article className="rounded-2xl border border-border bg-surface p-5" key={item.workItemId}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{item.processKey}</p><h3 className="mt-1 font-semibold">{item.processTitle}</h3></div><span className={`status-chip ${status === 'BLOCKED' ? 'bg-warning-surface text-warning' : 'bg-muted text-muted-foreground'}`}>{statusLabel}</span></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">{tProcess('step')}</dt><dd className="mt-1">{item.stepTitle}</dd></div><div><dt className="text-xs text-muted-foreground">{tProcess('subject')}</dt><dd className="mt-1">{item.subjectName ?? tProcess('unknown')}</dd></div><div><dt className="text-xs text-muted-foreground">{tProcess('deadline')}</dt><dd className="mt-1">{item.deadlineAt ?? tProcess('unknown')}</dd></div></dl><Link prefetch={false} className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={`/work/${item.workItemId}`}>{tProcess('open')}</Link></article>
            })}</div>}
          </section>
        )}
        {tab === "overview" && (
          <div className="space-y-5">
            <section aria-labelledby="employment-summary-title" className="rounded-2xl border bg-surface p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
                <div>
                  <p className="eyebrow">{t("employmentContext")}</p>
                  <h2 className="mt-1 text-xl font-semibold" id="employment-summary-title">{t("summaryTitle")}</h2>
                </div>
                <span className="status-chip bg-muted text-muted-foreground">{detail.employment.employment_number}</span>
              </div>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{t("summaryAdministration")}</dt>
                  <dd className="mt-2 font-semibold">{detail.administration.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{t("seniorityDate")}</dt>
                  <dd className="mt-2 font-semibold">
                    {detail.employment.seniority_date
                      ? formatDate(detail.employment.seniority_date, { locale, dateFormat: preferences.dateFormat })
                      : t("notRecorded")}
                    {seniority ? <span className="mt-1 block text-sm font-normal text-muted-foreground">{t("seniorityDuration", { years: seniority.years, months: seniority.months })}</span> : null}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 border-t pt-5">
                {currentContract ? <>
                  <h3 className="text-sm font-semibold">{t("contractDetails")}</h3>
                  <dl className="mt-4 grid gap-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
                    <div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{t("contractType")}</dt><dd className="mt-1 font-semibold">{contractTypeLabel}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{t("laborConditions")}</dt><dd className="mt-1 font-semibold">{currentContract.labor_condition_sets?.name ?? t("notRecorded")}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{t("weeklyHours")}</dt><dd className="mt-1 font-semibold">{contractHours === null ? t("notRecorded") : `${contractHours} ${t("hoursPerWeek")}`}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{t("department")}</dt><dd className="mt-1 font-semibold">{currentOrganization?.departments?.name ?? t("notRecorded")}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{t("jobTitle")}</dt><dd className="mt-1 font-semibold">{currentOrganization?.job_title ?? t("notRecorded")}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{t("workerType")}</dt><dd className="mt-1 font-semibold">{workerTypeLabel}</dd></div>
                  </dl>
                </> : <p className="text-sm text-muted-foreground">{t("noActiveContract")}</p>}
              </div>
            </section>
            {currentContract && <EmploymentOverviewActions
              labels={{
                sectionTitle: t("changeActionsTitle"),
                hoursSchedule: t("changeHoursSchedule"),
                hoursScheduleSalary: t("changeHoursScheduleSalary"),
                functionDepartmentCostCenter: t("changeFunctionDepartmentCostCenter"),
                salary: t("changeSalary"),
                laborConditions: t("changeLaborConditions"),
                contractTypeStartDate: t("changeContractTypeStartDate"),
                deleteContract: t("changeDeleteContract"),
                modalTitle: t("changeModalTitle"),
                cancel: t("cancel"),
                chooseContract: t("chooseContract"),
                contractSelectionTitle: t("contractSelectionTitle"),
                contractSelectionHelp: t("contractSelectionHelp"),
                contractNumber: t("contractNumber"),
                period: t("period"),
                selectedContractStatement: t("selectedContractStatement"),
                dateOutsideContract: t("dateOutsideContract"),
                contractStartOption: t("contractStartOption"),
                currentMonthOption: t("currentMonthOption"),
                nextMonthOption: t("nextMonthOption"),
                customDateOption: t("customDateOption"),
                changeStartDateTitle: t("changeStartDateTitle"),
                changeStartDateHelp: t("changeStartDateHelp"),
                timelineBeforeChange: t("timelineBeforeChange"),
                stepSelection: t("stepSelection"),
                stepDate: t("stepDate"),
                stepDetails: t("stepDetails"),
                stepReview: t("stepReview"),
                changeDetailsTitle: t("changeDetailsTitle"),
                reviewChangeTitle: t("reviewChangeTitle"),
                changeNotAvailable: t("changeNotAvailable"),
              }}
              dayLabels={[t("dayMonday"), t("dayTuesday"), t("dayWednesday"), t("dayThursday"), t("dayFriday"), t("daySaturday"), t("daySunday")]}
              employmentId={employmentId}
              today={today}
              locale={locale}
              data={{
                contracts: detail.contracts.map((contract) => ({
                  id: contract.id,
                  sequenceNumber: contract.sequence_number,
                  workerType: contract.worker_type,
                  laborConditionName: contract.labor_condition_sets?.name ?? t("notRecorded"),
                  fulltimeHoursPerWeek: Number(contract.fulltime_hours_per_week ?? contract.labor_condition_sets?.standard_hours_per_week ?? 40),
                  durationType: contract.duration_type,
                  startsOn: contract.starts_on,
                  endsOn: contract.ends_on,
                })),
                schedules: detail.schedules.map((row) => ({
                  id: row.id,
                  validFrom: row.valid_from,
                  validUntil: row.valid_until,
                  averageHours: Number(row.average_hours_per_week),
                  averageDays: Number(row.average_days_per_week),
                  partTimeFactor: Number(row.part_time_factor),
                  scheduleType: row.schedule_type,
                  mondayHours: row.monday_hours,
                  tuesdayHours: row.tuesday_hours,
                  wednesdayHours: row.wednesday_hours,
                  thursdayHours: row.thursday_hours,
                  fridayHours: row.friday_hours,
                  saturdayHours: row.saturday_hours,
                  sundayHours: row.sunday_hours,
                })),
                salaries: detail.salaries.map((row) => ({
                  id: row.id,
                  validFrom: row.valid_from,
                  validUntil: row.valid_until,
                  paymentType: row.payment_type,
                  paymentFrequency: row.payment_frequency,
                  salaryBasis: row.salary_basis,
                  fulltimeAmount: row.fulltime_amount,
                  parttimeAmount: row.parttime_amount,
                  hourlyRate: row.hourly_rate,
                  currencyCode: row.currency_code,
                  salaryScaleStepId: row.salary_scale_step_id,
                })),
                organizations: detail.organizations.map((row) => ({
                  id: row.id,
                  effectiveFrom: row.effective_from,
                  effectiveTo: row.effective_to,
                  departmentId: row.department_id,
                  departmentName: `${row.departments?.code ?? ""} · ${row.departments?.name ?? t("notRecorded")}`,
                  jobId: row.job_id,
                  jobName: row.job_title ?? t("notRecorded"),
                })),
                costAllocations: detail.costAllocations.map((row) => ({
                  id: row.id,
                  validFrom: row.valid_from,
                  validUntil: row.valid_until,
                  costCenterId: row.cost_center_id,
                  costCenterName: `${row.cost_centers?.code ?? ""} · ${row.cost_centers?.name ?? t("notRecorded")}`,
                  costCarrierId: row.cost_carrier_id,
                  costCarrierName: `${row.cost_carriers?.code ?? ""} · ${row.cost_carriers?.name ?? t("notRecorded")}`,
                  percentage: Number(row.percentage),
                })),
                options: {
                  departments: detail.options.departments.map((item) => ({ id: item.id, code: item.code, name: item.name })),
                  jobs: detail.options.jobs.map((item) => ({ id: item.id, code: item.code, name: item.name })),
                  costCenters: detail.options.costCenters.map((item) => ({ id: item.id, code: item.code, name: item.name })),
                  costCarriers: detail.options.costCarriers.map((item) => ({ id: item.id, code: item.code, name: item.name })),
                  salaryScaleSteps: detail.options.salaryScaleSteps.map((item) => ({ id: item.id, label: `${item.salary_scales?.code ?? ""} · ${item.step_name || item.step_code}`, fulltimeAmount: Number(item.fulltime_amount) })),
                },
              }}
            />}
            <EmploymentContractTimeline
              employeeId={employeeId}
              employmentId={employmentId}
              employmentStartsOn={detail.employment.starts_on}
              canWrite={detail.capabilities.canWriteContract}
              contracts={detail.contracts.map((contract) => ({
                id: contract.id,
                sequenceNumber: contract.sequence_number,
                workerType: contract.worker_type,
                flexPhaseId: contract.flex_phase_id,
                flexPhaseName: contract.flex_phases?.name ?? null,
                laborConditionSetId: contract.labor_condition_set_id,
                laborConditionName: contract.labor_condition_sets?.name ?? t("notRecorded"),
                fulltimeHoursPerWeek: Number(contract.fulltime_hours_per_week ?? contract.labor_condition_sets?.standard_hours_per_week ?? 40),
                durationType: contract.duration_type,
                startsOn: contract.starts_on,
                endsOn: contract.ends_on,
                probationApplies: contract.probation_applies,
                probationEndsOn: contract.probation_ends_on,
              }))}
              options={{
                laborConditionSets: detail.options.laborConditionSets.map((item) => ({ id: item.id, name: item.name, standardHoursPerWeek: item.standard_hours_per_week, probationMaximumMonths: item.probation_maximum_months === 2 ? 2 : 1 })),
                flexPhases: [...detail.options.flexPhases],
              }}
              labels={{
                title: t("contractsTitle"), add: t("contractAdd"), edit: t("change"),
                close: t("cancel"), save: t("confirm"), cancel: t("cancel"),
                flexPhase: t("flexPhase"),
                laborConditions: t("laborConditions"), fulltimeReference: t("fulltimeReference"), duration: t("duration"),
                startDate: t("startDate"), endDate: t("endsOn"),
                probation: t("probation"), probationEnd: t("probationEnd"),
                indefinite: t("indefinite"), definite: t("definite"), temporaryWithoutEnd: t("temporaryWithoutEnd"),
                yes: t("yes"), no: t("no"), active: t("active"),
                failed: t("changeFailed"), addBlocked: t("contractAddBlocked"), probationCaoMaximum: t("probationCaoMaximum"), firstContractStartDateHelp: t("firstContractStartDateHelp"), contractStartDateMinimumHelp: t("contractStartDateMinimumHelp"),
              }}
            />
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
                  { label: t("fulltimeReference"), value: String(row.fulltime_hours_per_week) },
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
              fulltimeHoursPerWeek={Number(detail.schedules[0]?.fulltime_hours_per_week ?? 40)}
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
        {tab === "company-location" && (
          <CompanyLocationTimelineManager
            employmentId={employmentId}
            canWrite={detail.capabilities.canWriteCompanyLocation}
            company={{
              name: detail.administration.name,
              single_location: detail.companyLocation.company?.single_location ?? true,
              address: detail.companyLocation.company ? {
                address_line_1: detail.companyLocation.company.address_line_1,
                address_line_2: detail.companyLocation.company.address_line_2,
                street: detail.companyLocation.company.street,
                house_number: detail.companyLocation.company.house_number,
                house_number_addition: detail.companyLocation.company.house_number_addition,
                postal_code: detail.companyLocation.company.postal_code,
                city: detail.companyLocation.company.city,
                region: detail.companyLocation.company.region,
                country_code: detail.companyLocation.company.country_code,
              } : null,
            }}
            locations={[...detail.companyLocation.locations]}
            assignments={[...detail.companyLocation.assignments]}
            labels={{
              title: t("companyLocationTitle"), description: t("companyLocationDescription"),
              company: t("company"), companyAddress: t("companyAddress"), locations: t("locations"),
              current: t("currentValue"), history: t("historyLabel"), active: t("active"),
              notRecorded: t("notRecorded"), readOnly: t("readOnly"), noLocations: t("noLocations"),
              location: t("location"), locationSearch: t("locationSearch"), locationSearchPlaceholder: t("locationSearchPlaceholder"),
              noLocationResults: t("noLocationResults"), add: t("timelineAdd"), edit: t("change"),
              save: t("confirm"), cancel: t("cancel"), effectiveOn: t("effectiveOn"),
              failed: t("changeFailed"), saving: t("saving"), changeSaved: t("changeSaved"),
              singleLocationMode: t("singleLocationMode"),
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
