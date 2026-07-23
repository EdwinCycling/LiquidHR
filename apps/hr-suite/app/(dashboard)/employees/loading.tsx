function EmployeeRowSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b px-4 sm:px-6 ${compact ? 'py-3' : 'py-5'}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <div className="size-11 shrink-0 animate-pulse rounded-xl bg-muted" />
        <div className="min-w-0 flex-1">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-5 w-48 max-w-full animate-pulse rounded bg-muted" />
          {!compact && <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-muted" />}
        </div>
      </div>
      <div className="h-6 w-24 animate-pulse rounded bg-muted" />
    </div>
  )
}

export default function EmployeesLoading() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-10 w-64 animate-pulse rounded bg-muted" />
      <div className="mt-8 rounded-2xl border bg-surface p-4">
        <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
      </div>
      <section className="mt-4 overflow-hidden rounded-2xl border bg-surface shadow-sm">
        {[0, 1, 2, 3, 4, 5].map((item) => <EmployeeRowSkeleton key={item} />)}
      </section>
    </main>
  )
}
