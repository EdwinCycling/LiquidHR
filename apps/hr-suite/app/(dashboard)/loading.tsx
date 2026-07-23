export default function DashboardRouteLoading() {
  return (
    <section aria-busy="true" className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-9 lg:px-10">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-10 w-64 animate-pulse rounded bg-muted" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div className="min-h-40 animate-pulse rounded-2xl border bg-surface p-5" key={item}>
            <div className="size-10 rounded-xl bg-muted" />
            <div className="mt-8 h-4 w-2/5 rounded bg-muted" />
            <div className="mt-3 h-8 w-1/4 rounded bg-muted" />
          </div>
        ))}
      </div>
    </section>
  )
}
