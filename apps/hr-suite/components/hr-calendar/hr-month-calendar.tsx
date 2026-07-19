"use client";
/* eslint-disable @next/next/no-img-element -- private avatar routes and customer-hosted URLs are intentionally rendered without remote image configuration. */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarDays, ChevronDown, Clock3, X } from "lucide-react";
import {
  buildMonthDays,
  formatScheduledHours,
  getCalendarDayOccupancy,
  formatCalendarWeekday,
  getCalendarWeekSegments,
  groupEventsByEmployee,
  isWeekendDay,
} from "@/lib/hr-calendar/calendar-model";
import type { Locale } from "@/lib/i18n/config";
import type { WeekNumberingSystem } from "@/lib/preferences/user-preferences";
import type { HrChangeEvent, HrChangeEventType } from "@/lib/hr-events/types";
import type {
  CalendarReminder,
  CalendarWorkDay,
} from "@/lib/hr-calendar/calendar-service";

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  birth_name: string;
  avatar_url: string | null;
  departmentId: string | null;
  averageMinutesPerWeek: number;
  jobId: string | null;
  jobName: string | null;
  jobGroupId: string | null;
  jobGroupName: string | null;
  workDays: Record<string, CalendarWorkDay>;
}
interface Holiday {
  id: string;
  holiday_date: string;
  display_name: string | null;
  provider_name: string;
  source: string;
}
interface Labels {
  noEvents: string;
  workHours: string;
  nonWorking: string;
  hoursPerWeek: string;
  holiday: string;
  reminder: string;
  generalReminders: string;
  dayDetails: string;
  employeeDayDetails: string;
  actionsLater: string;
  close: string;
  week: string;
  weekShort: string;
  weekOverview: string;
  selectedEmployees: string;
  noWeekItemsYet: string;
  job: string;
  jobGroup: string;
  dayOccupancy: string;
  dayOccupancyPersons: string;
  dayOccupancyHours: string;
  dayOccupancyPercentage: string;
  openEmployeeCard: string;
  employeeSection: string;
  employeesSection: string;
  actionsSection: string;
  events: Record<HrChangeEventType, string>;
}
type Selection =
  | { type: "week"; weekNumber: number; startDate: string; endDate: string }
  | { type: "day"; date: string }
  | { type: "employee-summary"; employee: Employee }
  | { type: "employee"; date: string; employee: Employee }
  | null;

export function HrMonthCalendar({
  month,
  locale,
  employees,
  events,
  holidays,
  reminders,
  generalReminders,
  showWeekendsAndHolidays,
  showReminders,
  showScheduledHours,
  showDayOccupancy,
  showWeekNumbers,
  selectedWeekStartDate,
  todayDate,
  weekNumberingSystem,
  labels,
}: {
  month: string;
  locale: Locale;
  employees: Employee[];
  events: HrChangeEvent[];
  holidays: Holiday[];
  reminders: CalendarReminder[];
  generalReminders: CalendarReminder[];
  showWeekendsAndHolidays: boolean;
  showReminders: boolean;
  showScheduledHours: boolean;
  showDayOccupancy: boolean;
  showWeekNumbers: boolean;
  selectedWeekStartDate?: string;
  todayDate: string;
  weekNumberingSystem: WeekNumberingSystem;
  labels: Labels;
}) {
  const days = buildMonthDays(month);
  const weekSegments = useMemo(
    () => (showWeekNumbers ? getCalendarWeekSegments(month, weekNumberingSystem) : []),
    [month, showWeekNumbers, weekNumberingSystem],
  );
  const dayOccupancy = useMemo(
    () => (showDayOccupancy ? getCalendarDayOccupancy(days, employees) : []),
    [days, employees, showDayOccupancy],
  );
  const grouped = groupEventsByEmployee(events);
  const [selection, setSelection] = useState<Selection>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isCurrentMonth = month === todayDate.slice(0, 7);
  const holidayByDate = useMemo(
    () => new Map(holidays.map((holiday) => [holiday.holiday_date, holiday])),
    [holidays],
  );
  const remindersByEmployee = useMemo(() => {
    const result = new Map<string, Map<string, CalendarReminder[]>>();
    for (const reminder of reminders) {
      if (!reminder.employeeId) continue;
      const byDate =
        result.get(reminder.employeeId) ??
        new Map<string, CalendarReminder[]>();
      byDate.set(reminder.date, [
        ...(byDate.get(reminder.date) ?? []),
        reminder,
      ]);
      result.set(reminder.employeeId, byDate);
    }
    return result;
  }, [reminders]);
  const selectedEmployeeEvents =
    selection?.type === "employee"
      ? (grouped.get(selection.employee.id)?.get(selection.date) ?? [])
      : [];
  const selectedEmployeeReminders =
    selection?.type === "employee"
      ? (remindersByEmployee.get(selection.employee.id)?.get(selection.date) ??
        [])
      : [];
  const selectedWorkDay =
    selection?.type === "employee"
      ? selection.employee.workDays[selection.date]
      : undefined;
  const selectedEmployee =
    selection?.type === "employee" || selection?.type === "employee-summary"
      ? selection.employee
      : null;
  const selectedHoliday =
    selection?.type === "week" || selection?.type === "employee-summary"
      ? undefined
      : selection
        ? holidayByDate.get(selection.date)
        : undefined;
  const selectedDayEmployees =
    selection?.type === "day"
      ? employees.map((employee) => {
          const workDay = employee.workDays[selection.date];
          const employeeEvents = grouped.get(employee.id)?.get(selection.date) ?? [];
          const employeeReminders =
            remindersByEmployee.get(employee.id)?.get(selection.date) ?? [];
          return {
            employee,
            workDay,
            employeeEvents,
            employeeReminders,
          };
        })
      : [];
  const selectedDateGeneralReminders =
    selection?.type === "day"
      ? generalReminders.filter((reminder) => reminder.date === selection.date)
      : [];
  useEffect(() => {
    const targetDate = selectedWeekStartDate ?? (isCurrentMonth ? todayDate : undefined);
    if (!targetDate || !scrollRef.current) return;
    const targetCell = scrollRef.current.querySelector<HTMLElement>(
      `[data-calendar-scroll-target="${targetDate}"]`,
    );
    if (!targetCell) return;
    const container = scrollRef.current;
    const targetLeft =
      targetCell.offsetLeft - container.clientWidth / 2 + targetCell.clientWidth / 2;
    container.scrollTo({
      left: Math.max(targetLeft, 0),
      behavior: "smooth",
    });
  }, [isCurrentMonth, month, selectedWeekStartDate, todayDate]);

  return (
    <div className="relative">
      <div
        className="overflow-auto rounded-2xl border bg-surface shadow-sm"
        ref={scrollRef}
      >
        <div className="min-w-max">
          <div className="sticky top-0 z-20 bg-surface">
            {showWeekNumbers ? (
              <div
                className="grid bg-surface"
                style={{
                  gridTemplateColumns: `18rem repeat(${days.length},2.75rem)`,
                }}
              >
                <div className="sticky left-0 z-30 border-b border-r bg-surface p-3" />
                {weekSegments.map((segment) => (
                  <button
                    className={`border-b border-r px-2 py-1 text-center text-[11px] font-semibold hover:bg-accent ${selectedWeekStartDate === segment.startDate ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground"}`}
                    key={`${segment.startDate}-${segment.weekNumber}`}
                    onClick={() =>
                      setSelection({
                        type: "week",
                        weekNumber: segment.weekNumber,
                        startDate: segment.startDate,
                        endDate: segment.endDate,
                      })
                    }
                    style={{ gridColumn: `${segment.startIndex + 2} / span ${segment.span}` }}
                    title={`${labels.week} ${segment.weekNumber}`}
                    type="button"
                  >
                    {labels.weekShort} {segment.weekNumber}
                  </button>
                ))}
              </div>
            ) : null}
            <div
              className="grid bg-surface"
              style={{
                gridTemplateColumns: `18rem repeat(${days.length},2.75rem)`,
              }}
            >
              <div className="sticky left-0 z-30 border-b border-r bg-surface p-3" />
              {days.map((day) => {
                const holiday = holidayByDate.get(day);
                const isWeekend = isWeekendDay(day);
                const isToday = day === todayDate;
                return (
                  <button
                    className={`border-b border-r p-1.5 text-center text-[11px] font-semibold hover:bg-accent ${isToday ? "bg-primary/10 text-primary shadow-[inset_0_-2px_0_0_var(--color-primary)]" : showWeekendsAndHolidays && holiday ? "bg-warning-surface text-warning" : showWeekendsAndHolidays && isWeekend ? "bg-muted/50" : ""}`}
                    data-calendar-scroll-target={day}
                    data-calendar-today={isToday ? day : undefined}
                    key={day}
                    onClick={() => setSelection({ type: "day", date: day })}
                    title={holiday?.display_name ?? holiday?.provider_name}
                    type="button"
                  >
                    <span className="block text-[9px] uppercase text-muted-foreground">
                      {formatCalendarWeekday(day, locale)}
                    </span>
                    {Number(day.slice(-2))}
                  </button>
                );
              })}
            </div>
          </div>
          {employees.map((employee) => (
            <div
              className="grid min-h-14"
              key={employee.id}
              style={{
                gridTemplateColumns: `18rem repeat(${days.length},2.75rem)`,
              }}
            >
              <button
                className="sticky left-0 z-10 flex items-center gap-3 border-b border-r bg-surface p-2.5 text-sm font-semibold hover:text-primary"
                onClick={() =>
                  setSelection({
                    type: "employee-summary",
                    employee,
                  })
                }
                type="button"
              >
                {employee.avatar_url ? (
                  <img src={employee.avatar_url} alt="" className="size-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                    {employee.first_name[0]}
                    {employee.birth_name[0]}
                  </span>
                )}
                <span className="min-w-0 truncate">
                  {employee.first_name} {employee.birth_name}
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {(employee.averageMinutesPerWeek / 60).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 2 },
                    )}{" "}
                    {labels.hoursPerWeek}
                  </span>
                </span>
              </button>
              {days.map((day) => {
                const items = grouped.get(employee.id)?.get(day) ?? [];
                const dayReminders =
                  remindersByEmployee.get(employee.id)?.get(day) ?? [];
                const work = employee.workDays[day];
                const holiday = holidayByDate.get(day);
                const isWeekend = isWeekendDay(day);
                const isToday = day === todayDate;
                return (
                  <button
                    className={`relative flex min-h-14 flex-col items-center justify-center gap-1 border-b border-r p-1 hover:bg-accent/70 ${isToday ? "bg-primary/5 ring-1 ring-inset ring-primary/25" : showWeekendsAndHolidays && holiday ? "bg-warning-surface/65" : showWeekendsAndHolidays && isWeekend ? "bg-muted/35" : ""}`}
                    key={day}
                    onClick={() =>
                      setSelection({ type: "employee", date: day, employee })
                    }
                    title={
                      work?.isWorkingDay
                        ? `${labels.workHours} ${work.scheduledMinutes / 60}h`
                        : labels.nonWorking
                    }
                  >
                    {work && !work.isWorkingDay ? (
                      <span className="h-1.5 w-full rounded-full bg-muted-foreground/45" />
                    ) : null}
                    <span className="flex flex-wrap justify-center gap-0.5">
                      {items.map((event) => (
                        <span
                          aria-label={labels.events[event.eventType]}
                          className={`size-2 rounded-full ${event.severity === "ATTENTION" ? "bg-warning" : "bg-primary"}`}
                          key={event.id}
                        />
                      ))}
                    </span>
                    {showScheduledHours && work?.scheduledMinutes > 0 ? (
                      <span className="text-[9px] font-semibold text-muted-foreground">
                        {formatScheduledHours(work.scheduledMinutes)}
                      </span>
                    ) : null}
                    {showReminders && dayReminders.length ? (
                      <Bell className="text-accent-foreground" size={11} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
          {showDayOccupancy ? (
            <div
              className="grid min-h-16"
              style={{
                gridTemplateColumns: `18rem repeat(${days.length},2.75rem)`,
              }}
            >
              <div className="sticky left-0 z-10 flex items-center border-r bg-surface p-2.5 text-sm font-semibold text-primary">
                {labels.dayOccupancy}
              </div>
              {dayOccupancy.map((occupancy) => (
                <div
                  className="flex min-h-16 flex-col items-center justify-center gap-0.5 border-b border-r bg-muted/20 px-1 py-1 text-center"
                  key={occupancy.date}
                  title={`${labels.dayOccupancyPersons}: ${occupancy.employeeCount} · ${labels.dayOccupancyHours}: ${formatScheduledHours(occupancy.availableMinutes)} · ${labels.dayOccupancyPercentage}: ${occupancy.availabilityPercentage}%`}
                >
                  <span className="text-[10px] font-semibold">
                    {occupancy.employeeCount}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {formatScheduledHours(occupancy.availableMinutes)}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {occupancy.availabilityPercentage}%
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {employees.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          {labels.noEvents}
        </p>
      ) : null}
      {selection ? (
        <aside className="fixed inset-y-0 right-0 z-50 w-[min(32rem,calc(100vw-1rem))] overflow-y-auto border-l bg-surface p-5 shadow-2xl lg:w-2/3 lg:max-w-[72rem]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">
                {selection.type === "week"
                  ? labels.weekOverview
                  : selection.type === "day"
                    ? labels.dayDetails
                    : selection.type === "employee"
                      ? labels.employeeDayDetails
                      : labels.employeeSection}
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                {selection.type === "week"
                  ? `${labels.week} ${selection.weekNumber}`
                  : selection.type === "employee"
                    ? `${selection.employee.first_name} ${selection.employee.birth_name} · `
                    : selection.type === "employee-summary"
                      ? `${selection.employee.first_name} ${selection.employee.birth_name}`
                      : ""}
                {selection.type === "week"
                  ? `${selection.startDate} — ${selection.endDate}`
                  : selection.type === "employee-summary"
                    ? ""
                    : selection.date}
              </h2>
            </div>
            <button
              aria-label={labels.close}
              className="grid size-9 place-items-center rounded-lg hover:bg-muted"
              onClick={() => setSelection(null)}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
          {selectedHoliday ? (
            <div className="mt-5 rounded-xl bg-accent p-4">
              <p className="text-xs font-semibold uppercase tracking-wide">
                {labels.holiday}
              </p>
              <p className="mt-1 font-semibold">
                {selectedHoliday.display_name ?? selectedHoliday.provider_name}
              </p>
            </div>
          ) : null}
          {selection.type === "employee-summary" ? (
            <>
              <div className="mt-5 space-y-3">
                <CalendarSidePanelSection title={labels.employeeSection}>
                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-semibold">
                      {selectedEmployee?.jobName ?? labels.job}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {labels.job}
                        </p>
                        <p className="mt-1 text-sm">
                          {selectedEmployee?.jobName ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {labels.jobGroup}
                        </p>
                        <p className="mt-1 text-sm">
                          {selectedEmployee?.jobGroupName ?? "—"}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {selectedEmployee
                        ? `${(selectedEmployee.averageMinutesPerWeek / 60).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })} ${labels.hoursPerWeek}`
                        : ""}
                    </p>
                  </div>
                </CalendarSidePanelSection>
                <CalendarSidePanelSection title={labels.actionsSection}>
                  {selectedEmployee ? (
                    <Link
                      className="button-secondary w-full justify-center"
                      href={`/employees/${selectedEmployee.id}`}
                    >
                      {labels.openEmployeeCard}
                    </Link>
                  ) : null}
                  <button
                    className="w-full rounded-xl border border-dashed p-4 text-sm font-semibold text-muted-foreground"
                    disabled
                    type="button"
                  >
                    {labels.actionsLater}
                  </button>
                </CalendarSidePanelSection>
              </div>
            </>
          ) : selection.type === "employee" ? (
            <>
              <div className="mt-5 space-y-3">
                <CalendarSidePanelSection title={labels.employeeSection}>
                  <div className="rounded-xl border p-4">
                    <div className="flex items-center gap-2 font-semibold">
                      <Clock3 className="text-primary" size={17} />
                      {selectedWorkDay?.isWorkingDay
                        ? labels.workHours
                        : labels.nonWorking}
                    </div>
                    {selectedWorkDay?.isWorkingDay ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {selectedWorkDay.startsAt} — {selectedWorkDay.endsAt} ·{" "}
                        {selectedWorkDay.scheduledMinutes / 60}h
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {selectedEmployeeEvents.map((event) => (
                      <Link
                        className="block rounded-xl bg-muted p-3 text-sm font-semibold hover:text-primary"
                        href={event.sourceHref}
                        key={event.id}
                      >
                        {labels.events[event.eventType]}
                      </Link>
                    ))}
                    {showReminders
                      ? selectedEmployeeReminders.map((reminder) => (
                          <div
                            className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm"
                            key={reminder.id}
                          >
                            <Bell size={15} />
                            {reminder.title}
                          </div>
                        ))
                      : null}
                  </div>
                </CalendarSidePanelSection>
                <CalendarSidePanelSection title={labels.actionsSection}>
                  <Link
                    className="button-secondary w-full justify-center"
                    href={`/employees/${selection.employee.id}`}
                  >
                    {labels.openEmployeeCard}
                  </Link>
                  <button
                    className="w-full rounded-xl border border-dashed p-4 text-sm font-semibold text-muted-foreground"
                    disabled
                    type="button"
                  >
                    {labels.actionsLater}
                  </button>
                </CalendarSidePanelSection>
              </div>
            </>
          ) : selection.type === "week" ? (
            <>
              <div className="mt-5 space-y-3">
                <CalendarSidePanelSection
                  badge={`${employees.length}`}
                  title={labels.employeesSection}
                >
                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-semibold">{labels.selectedEmployees}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {employees.length} · {selection.startDate} — {selection.endDate}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {employees.map((employee) => (
                      <div className="rounded-xl border p-4" key={employee.id}>
                        <p className="text-sm font-semibold">
                          {employee.first_name} {employee.birth_name}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {labels.noWeekItemsYet}
                        </p>
                      </div>
                    ))}
                  </div>
                </CalendarSidePanelSection>
                <CalendarSidePanelSection title={labels.actionsSection}>
                  <button
                    className="w-full rounded-xl border border-dashed p-4 text-sm font-semibold text-muted-foreground"
                    disabled
                    type="button"
                  >
                    {labels.actionsLater}
                  </button>
                </CalendarSidePanelSection>
              </div>
            </>
          ) : (
            <>
              <div className="mt-5 space-y-3">
                <CalendarSidePanelSection
                  badge={`${selectedDayEmployees.length}`}
                  title={labels.employeesSection}
                >
                  {selectedDateGeneralReminders.length ? (
                    <div className="rounded-xl bg-accent p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">
                        {labels.generalReminders}
                      </p>
                      <div className="mt-3 space-y-2">
                        {selectedDateGeneralReminders.map((reminder) => (
                          <div
                            className="flex items-center gap-2 rounded-xl bg-background/80 p-3 text-sm"
                            key={reminder.id}
                          >
                            <Bell size={15} />
                            {labels.reminder}: {reminder.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    {selectedDayEmployees.map(
                      ({ employee, workDay, employeeEvents, employeeReminders }) => (
                        <div className="rounded-xl border p-4" key={employee.id}>
                          <div className="flex items-start justify-between gap-3">
                            <Link
                              className="text-sm font-semibold hover:text-primary"
                              href={`/employees/${employee.id}`}
                            >
                              {employee.first_name} {employee.birth_name}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {workDay?.isWorkingDay && workDay.scheduledMinutes > 0
                                ? formatScheduledHours(workDay.scheduledMinutes)
                                : labels.nonWorking}
                            </span>
                          </div>
                          {workDay?.isWorkingDay ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {workDay.startsAt} — {workDay.endsAt}
                            </p>
                          ) : null}
                          {employeeEvents.length || (showReminders && employeeReminders.length) ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {employeeEvents.map((event) => (
                                <Link
                                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium hover:text-primary"
                                  href={event.sourceHref}
                                  key={event.id}
                                >
                                  <CalendarDays size={12} />
                                  {labels.events[event.eventType]}
                                </Link>
                              ))}
                              {showReminders
                                ? employeeReminders.map((reminder) => (
                                    <span
                                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                                      key={reminder.id}
                                    >
                                      <Bell size={12} />
                                      {reminder.title}
                                    </span>
                                  ))
                                : null}
                            </div>
                          ) : null}
                        </div>
                      ),
                    )}
                  </div>
                </CalendarSidePanelSection>
                <CalendarSidePanelSection title={labels.actionsSection}>
                  <button
                    className="w-full rounded-xl border border-dashed p-4 text-sm font-semibold text-muted-foreground"
                    disabled
                    type="button"
                  >
                    {labels.actionsLater}
                  </button>
                </CalendarSidePanelSection>
              </div>
            </>
          )}
        </aside>
      ) : null}
    </div>
  );
}

function CalendarSidePanelSection({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border bg-background">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold">
        <span className="inline-flex items-center gap-2">
          {title}
          {badge ? (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
              {badge}
            </span>
          ) : null}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t px-4 py-4">{children}</div>
    </details>
  );
}
