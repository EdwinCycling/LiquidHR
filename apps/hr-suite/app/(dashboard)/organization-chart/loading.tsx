export default function OrganizationChartLoading() {
  return (
    <section aria-busy="true" className="mx-auto w-full max-w-[96rem] px-4 py-7 sm:px-8 sm:py-9 lg:px-10">
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-10 w-64 animate-pulse rounded bg-muted" />
      <div className="mt-8 h-16 animate-pulse rounded-2xl border bg-surface" />
      <div className="mt-6 min-h-[28rem] animate-pulse rounded-2xl border bg-surface" />
    </section>
  )
}
