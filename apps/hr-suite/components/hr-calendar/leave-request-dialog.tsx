"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { LeaveRequestPreview } from "@/lib/leave/request-service";

type RequestMode = "PRIORITY" | "DIRECT";
type TimeMode = "FULL_DAY" | "MORNING" | "AFTERNOON" | "SPECIFIC_HOURS";

type Labels = {
  title: string;
  viaPriority: string;
  withoutPriority: string;
  leaveType: string;
  priorityRule: string;
  noPriorityRules: string;
  currentBalance: string;
  projectedBalance: string;
  unlimited: string;
  fullDay: string;
  morning: string;
  afternoon: string;
  specificHours: string;
  startDate: string;
  endDate: string;
  totalTime: string;
  confirm: string;
  cancel: string;
  close: string;
  loading: string;
  success: string;
  failed: string;
  noBalance: string;
};

export function LeaveRequestDialog({
  employeeId,
  startDate,
  initialMode,
  locale,
  labels,
  onClose,
}: {
  employeeId: string;
  startDate: string;
  initialMode: RequestMode;
  locale: Locale;
  labels: Labels;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<RequestMode>(initialMode);
  const [endDate, setEndDate] = useState(startDate);
  const [timeMode, setTimeMode] = useState<TimeMode>("FULL_DAY");
  const [specificStart, setSpecificStart] = useState("09:00");
  const [specificEnd, setSpecificEnd] = useState("17:00");
  const [preview, setPreview] = useState<LeaveRequestPreview | null>(null);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [priorityRuleId, setPriorityRuleId] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "saving" | "success" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ employeeId, startDate, endDate, mode });
    fetch(`/api/leave/request/preview?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("preview");
        const body = (await response.json()) as { data: LeaveRequestPreview };
        setPreview(body.data);
        setLeaveTypeId((current) => current || body.data.types[0]?.id || "");
        setPriorityRuleId((current) => current || body.data.priorityRules[0]?.id || "");
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      });
    return () => controller.abort();
  }, [employeeId, startDate, endDate, mode]);

  const selectedType = useMemo(() => preview?.types.find((type) => type.id === leaveTypeId) ?? null, [leaveTypeId, preview]);
  const totalMinutes = timeMode === "FULL_DAY" ? preview?.fullDayMinutes ?? 0 : timeMode === "MORNING" || timeMode === "AFTERNOON" ? preview?.halfDayMinutes ?? 0 : specificMinutes(specificStart, specificEnd);
  const totalHours = (totalMinutes / 60).toLocaleString(locale === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 2 });

  async function confirm() {
    if (!preview || state === "saving") return;
    setState("saving");
    const idempotencyKey = `${employeeId}:${preview.employmentId}:${startDate}:${endDate}:${mode}:${leaveTypeId || priorityRuleId}:${timeMode}`;
    const response = await fetch("/api/leave/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        employeeId,
        employmentId: preview.employmentId,
        mode,
        leaveTypeId: mode === "DIRECT" ? leaveTypeId : null,
        priorityRuleId: mode === "PRIORITY" ? priorityRuleId : null,
        startDate,
        endDate,
        timeMode,
        specificStart: timeMode === "SPECIFIC_HOURS" ? specificStart : null,
        specificEnd: timeMode === "SPECIFIC_HOURS" ? specificEnd : null,
        idempotencyKey,
      }),
    });
    if (!response.ok) {
      setState("error");
      return;
    }
    setState("success");
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-foreground/30 p-4">
      <section aria-modal="true" className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-surface p-5 shadow-2xl" role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{labels.title}</p>
            <h2 className="mt-2 text-xl font-semibold">{startDate}</h2>
          </div>
          <button aria-label={labels.close} className="button-ghost" onClick={onClose} type="button">×</button>
        </div>
        {state === "success" ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl bg-success-surface p-4 text-sm font-semibold text-success-foreground">{labels.success}</p>
            <button className="button-primary w-full justify-center" onClick={onClose} type="button">{labels.close}</button>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 rounded-xl border p-1">
              <button className={mode === "PRIORITY" ? "button-primary justify-center" : "button-ghost justify-center"} onClick={() => { setState("loading"); setMode("PRIORITY"); }} type="button">{labels.viaPriority}</button>
              <button className={mode === "DIRECT" ? "button-primary justify-center" : "button-ghost justify-center"} onClick={() => { setState("loading"); setMode("DIRECT"); }} type="button">{labels.withoutPriority}</button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">{labels.startDate}<input className="form-field" type="date" value={startDate} readOnly /></label>
              <label className="grid gap-1.5 text-sm font-medium">{labels.endDate}<input className="form-field" min={startDate} onChange={(event) => { setState("loading"); setEndDate(event.target.value); }} type="date" value={endDate} /></label>
            </div>
            {mode === "DIRECT" ? (
              <label className="mt-4 grid gap-1.5 text-sm font-medium">{labels.leaveType}
                <select className="form-field" onChange={(event) => setLeaveTypeId(event.target.value)} value={leaveTypeId}>
                  {preview?.types.map((type) => <option key={type.id} value={type.id}>{type.name} — {type.status === "UNLIMITED" ? labels.unlimited : `${type.currentBalanceHours ?? 0}u ${labels.currentBalance} · ${type.projectedEndBalanceHours ?? 0}u ${labels.projectedBalance}`}</option>)}
                </select>
              </label>
            ) : (
              <label className="mt-4 grid gap-1.5 text-sm font-medium">{labels.priorityRule}
                <select className="form-field" disabled={!preview?.priorityRules.length} onChange={(event) => setPriorityRuleId(event.target.value)} value={priorityRuleId}>
                  {preview?.priorityRules.length ? preview.priorityRules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name} · {rule.itemCount}</option>) : <option value="">{labels.noPriorityRules}</option>}
                </select>
              </label>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([['FULL_DAY', labels.fullDay], ['MORNING', labels.morning], ['AFTERNOON', labels.afternoon], ['SPECIFIC_HOURS', labels.specificHours]] as const).map(([value, label]) => <button className={timeMode === value ? "button-primary justify-center" : "button-secondary justify-center"} disabled={endDate !== startDate && value !== "FULL_DAY"} key={value} onClick={() => setTimeMode(value)} type="button">{label}</button>)}
            </div>
            {timeMode === "SPECIFIC_HOURS" ? <div className="mt-4 grid grid-cols-2 gap-4"><label className="grid gap-1.5 text-sm font-medium">{labels.startDate}<input className="form-field" onChange={(event) => setSpecificStart(event.target.value)} type="time" value={specificStart} /></label><label className="grid gap-1.5 text-sm font-medium">{labels.endDate}<input className="form-field" onChange={(event) => setSpecificEnd(event.target.value)} type="time" value={specificEnd} /></label></div> : null}
            <div className="mt-5 rounded-xl bg-muted p-4 text-sm"><span className="font-semibold">{labels.totalTime}: </span>{totalHours}u{selectedType?.status === "NO_BALANCE" ? <span className="ml-2 text-destructive">{labels.noBalance}</span> : null}</div>
            {state === "loading" ? <p className="mt-4 text-sm text-muted-foreground">{labels.loading}</p> : null}
            {state === "error" ? <p className="mt-4 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{labels.failed}</p> : null}
            <div className="mt-5 flex justify-end gap-2"><button className="button-secondary" onClick={onClose} type="button">{labels.cancel}</button><button className="button-primary" disabled={state !== "ready" || (mode === "DIRECT" && !leaveTypeId) || (mode === "PRIORITY" && !priorityRuleId)} onClick={() => void confirm()} type="button">{state === "saving" ? labels.loading : labels.confirm}</button></div>
          </>
        )}
      </section>
    </div>
  );
}

function specificMinutes(start: string, end: string): number {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  return minutes > 0 ? minutes : 0;
}
