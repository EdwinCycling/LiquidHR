"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

interface Scale {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}
interface Revision {
  id: string;
  salary_scale_id: string;
  revision_number: number;
  status: string;
  description: string | null;
  valid_from: string;
  valid_until: string | null;
}
interface Step {
  id: string;
  salary_scale_revision_id: string;
  step_code: string;
  step_name: string;
  sequence_number: number;
  step_kind: string;
  fulltime_amount?: number | null;
  hourly_amount?: number | null;
  currency_code: string;
}
interface Labels {
  scales: string;
  revisions: string;
  code: string;
  name: string;
  description: string;
  validFrom: string;
  validUntil: string;
  createScale: string;
  publishRevision: string;
  steps: string;
  stepCode: string;
  stepName: string;
  amount: string;
  addStep: string;
  removeStep: string;
  saving: string;
  failed: string;
  empty: string;
  amountsRestricted: string;
}
interface DraftStep {
  stepCode: string;
  stepName: string;
  fulltimeAmount: string;
}
const inputClass =
  "mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm";

export function SalaryScaleManager({
  scales,
  revisions,
  steps,
  canReadAmounts,
  labels,
}: {
  scales: Scale[];
  revisions: Revision[];
  steps: Step[];
  canReadAmounts: boolean;
  labels: Labels;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [scaleId, setScaleId] = useState(scales[0]?.id ?? "");
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([
    { stepCode: "0", stepName: "", fulltimeAmount: "" },
  ]);
  const today = new Date().toISOString().slice(0, 10);
  async function createScale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/master-data/salary-scales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    setSaving(false);
    setFailed(!response.ok);
    if (response.ok) {
      event.currentTarget.reset();
      router.refresh();
    }
  }
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scaleId) return;
    setSaving(true);
    setFailed(false);
    const form = new FormData(event.currentTarget);
    const payload = {
      validFrom: form.get("validFrom"),
      validUntil: form.get("validUntil") || null,
      description: form.get("description") || null,
      steps: draftSteps.map((step, index) => ({
        ...step,
        sequenceNumber: index,
        fulltimeAmount: Number(step.fulltimeAmount),
        hourlyAmount: null,
        stepKind:
          index === draftSteps.length - 1
            ? "MAXIMUM"
            : index === 0
              ? "START"
              : "REGULAR",
      })),
    };
    const response = await fetch(
      `/api/master-data/salary-scales/${scaleId}/revisions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setSaving(false);
    setFailed(!response.ok);
    if (response.ok) router.refresh();
  }
  function updateStep(index: number, field: keyof DraftStep, value: string) {
    setDraftSteps((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{labels.scales}</h2>
        <form
          className="mt-4 grid gap-3 md:grid-cols-3"
          onSubmit={(event) => void createScale(event)}
        >
          <label className="text-sm font-medium">
            {labels.code}
            <input className={inputClass} name="code" required />
          </label>
          <label className="text-sm font-medium">
            {labels.name}
            <input className={inputClass} name="name" required />
          </label>
          <label className="text-sm font-medium">
            {labels.description}
            <input className={inputClass} name="description" />
          </label>
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground md:col-span-3"
            disabled={saving}
          >
            {saving ? labels.saving : labels.createScale}
          </button>
        </form>
      </section>
      <section className="rounded-2xl border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{labels.revisions}</h2>
        {scales.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => void publish(event)}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm font-medium">
                {labels.scales}
                <select
                  className={inputClass}
                  value={scaleId}
                  onChange={(event) => setScaleId(event.target.value)}
                >
                  {scales.map((scale) => (
                    <option key={scale.id} value={scale.id}>
                      {scale.code} · {scale.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                {labels.validFrom}
                <input
                  className={inputClass}
                  defaultValue={today}
                  name="validFrom"
                  type="date"
                  required
                />
              </label>
              <label className="text-sm font-medium">
                {labels.validUntil}
                <input className={inputClass} name="validUntil" type="date" />
              </label>
            </div>
            <label className="block text-sm font-medium">
              {labels.description}
              <input className={inputClass} name="description" />
            </label>
            <div>
              <h3 className="font-semibold">{labels.steps}</h3>
              <div className="mt-2 space-y-2">
                {draftSteps.map((step, index) => (
                  <div
                    className="grid gap-2 rounded-xl bg-muted p-3 sm:grid-cols-[8rem_1fr_10rem_auto]"
                    key={index}
                  >
                    <input
                      aria-label={labels.stepCode}
                      className={inputClass}
                      value={step.stepCode}
                      onChange={(event) =>
                        updateStep(index, "stepCode", event.target.value)
                      }
                      required
                    />
                    <input
                      aria-label={labels.stepName}
                      className={inputClass}
                      value={step.stepName}
                      onChange={(event) =>
                        updateStep(index, "stepName", event.target.value)
                      }
                      required
                    />
                    <input
                      aria-label={labels.amount}
                      className={inputClass}
                      min="0"
                      step="0.01"
                      type="number"
                      value={step.fulltimeAmount}
                      onChange={(event) =>
                        updateStep(index, "fulltimeAmount", event.target.value)
                      }
                      required
                    />
                    <button
                      aria-label={labels.removeStep}
                      className="self-end rounded-lg p-2 text-destructive"
                      disabled={draftSteps.length === 1}
                      onClick={() =>
                        setDraftSteps((items) =>
                          items.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
                onClick={() =>
                  setDraftSteps((items) => [
                    ...items,
                    {
                      stepCode: String(items.length),
              stepName: '',
                      fulltimeAmount: "",
                    },
                  ])
                }
                type="button"
              >
                <Plus className="h-4 w-4" />
                {labels.addStep}
              </button>
            </div>
            <button
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              disabled={saving}
            >
              {saving ? labels.saving : labels.publishRevision}
            </button>
          </form>
        )}
        {failed && (
          <p className="mt-3 text-sm text-destructive">{labels.failed}</p>
        )}
      </section>
      <section className="rounded-2xl border bg-surface p-5 shadow-sm">
        {!canReadAmounts && (
          <p className="mb-3 text-sm text-muted-foreground">
            {labels.amountsRestricted}
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {revisions.map((revision) => (
            <article className="rounded-xl border p-4" key={revision.id}>
              <p className="font-semibold">
                {
                  scales.find((scale) => scale.id === revision.salary_scale_id)
                    ?.name
                }{" "}
                · #{revision.revision_number}
              </p>
              <p className="text-xs text-muted-foreground">
                {revision.valid_from}
                {revision.valid_until ? ` – ${revision.valid_until}` : ""}
              </p>
              <ol className="mt-3 space-y-1 text-sm">
                {steps
                  .filter(
                    (step) => step.salary_scale_revision_id === revision.id,
                  )
                  .map((step) => (
                    <li className="flex justify-between gap-3" key={step.id}>
                      <span>
                        {step.step_code} · {step.step_name}
                      </span>
                      {canReadAmounts && (
                        <span className="tabular-nums">
                          €{" "}
                          {Number(step.fulltime_amount ?? 0).toLocaleString(
                            "nl-NL",
                            { minimumFractionDigits: 2 },
                          )}
                        </span>
                      )}
                    </li>
                  ))}
              </ol>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
