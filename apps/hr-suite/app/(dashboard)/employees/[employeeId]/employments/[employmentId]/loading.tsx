export default function EmploymentDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9" aria-busy="true" aria-label="Dienstverband laden">
      <div className="h-5 w-44 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-44 animate-pulse rounded-3xl border bg-surface" />
      <div className="mt-5 h-14 animate-pulse rounded-2xl border bg-surface" />
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-2xl border bg-surface" />
        <div className="h-56 animate-pulse rounded-2xl border bg-surface" />
      </div>
    </main>
  )
}
