"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

interface Group {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}
interface JobRevision {
  id: string;
  name: string;
  description: string | null;
  valid_from: string;
  valid_until: string | null;
}
interface Job {
  id: string;
  code: string;
  job_group_id: string;
  is_active: boolean;
  job_revisions: JobRevision[];
}
interface Labels {
  groups: string;
  jobs: string;
  code: string;
  name: string;
  description: string;
  group: string;
  validFrom: string;
  validUntil: string;
  createGroup: string;
  createJob: string;
  empty: string;
  saving: string;
  failed: string;
  active: string;
}

const inputClass =
  "mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm";

export function JobCatalogManager({
  groups,
  jobs,
  labels,
}: {
  groups: Group[];
  jobs: Job[];
  labels: Labels;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function submit(event: FormEvent<HTMLFormElement>, endpoint: string) {
    event.preventDefault();
    setSaving(true);
    setFailed(false);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      [...form.entries()].map(([key, value]) => [key, value || null]),
    );
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!response.ok) {
      setFailed(true);
      return;
    }
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{labels.groups}</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) =>
            void submit(event, "/api/master-data/job-groups")
          }
        >
          <label className="text-sm font-medium">
            {labels.code}
            <input className={inputClass} name="code" required />
          </label>
          <label className="text-sm font-medium">
            {labels.name}
            <input className={inputClass} name="name" required />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            {labels.description}
            <textarea className={inputClass} name="description" rows={2} />
          </label>
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:col-span-2"
            disabled={saving}
          >
            {saving ? labels.saving : labels.createGroup}
          </button>
        </form>
        {failed && (
          <p className="mt-3 text-sm text-destructive">{labels.failed}</p>
        )}
        <div className="mt-5 space-y-2">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            groups.map((group) => (
              <article className="rounded-xl bg-muted p-3" key={group.id}>
                <p className="font-semibold">
                  {group.code} · {group.name}
                </p>
                {group.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {group.description}
                  </p>
                )}
              </article>
            ))
          )}
        </div>
      </section>
      <section className="rounded-2xl border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{labels.jobs}</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => void submit(event, "/api/master-data/jobs")}
        >
          <label className="text-sm font-medium">
            {labels.code}
            <input className={inputClass} name="code" required />
          </label>
          <label className="text-sm font-medium">
            {labels.group}
            <select className={inputClass} name="jobGroupId" required>
              <option value="" />
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.code} · {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            {labels.name}
            <input className={inputClass} name="name" required />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            {labels.description}
            <textarea className={inputClass} name="description" rows={2} />
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
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:col-span-2"
            disabled={saving}
          >
            {saving ? labels.saving : labels.createJob}
          </button>
        </form>
        <div className="mt-5 space-y-2">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            jobs.map((job) => {
              const revision = [...job.job_revisions].sort((a, b) =>
                b.valid_from.localeCompare(a.valid_from),
              )[0];
              return (
                <article className="rounded-xl border p-3" key={job.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">
                      {job.code} · {revision?.name}
                    </p>
                    <span className="status-chip">{labels.active}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {revision?.valid_from}
                    {revision?.valid_until ? ` – ${revision.valid_until}` : ""}
                  </p>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
