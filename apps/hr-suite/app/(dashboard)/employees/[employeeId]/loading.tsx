export default function EmployeeDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10" aria-busy="true" aria-label="Medewerker laden">
      <div className="h-5 w-36 animate-pulse rounded bg-muted" />
      <div className="mt-5 h-40 animate-pulse rounded-2xl border bg-surface" />
      <div className="mt-6 h-12 animate-pulse rounded-xl border bg-surface" />
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="h-36 animate-pulse rounded-2xl border bg-surface" />
        <div className="h-36 animate-pulse rounded-2xl border bg-surface" />
      </div>
    </main>
  )
}
