type CompassPoint = {
  id: string
  x: number
  y: number
  label: string
  kind?: 'inner' | 'outer' | 'team'
}

export function TeamCompassCompass({ points, labels }: {
  points: CompassPoint[]
  labels: { action: string; vision: string; harmony: string; logic: string; inner?: string; outer?: string }
}) {
  const position = (value: number) => 250 + Math.max(-100, Math.min(100, value)) * 1.85
  return (
    <figure className="w-full" aria-label={`${labels.action}, ${labels.vision}, ${labels.harmony}, ${labels.logic}`}>
      <svg className="mx-auto h-auto w-full max-w-[38rem]" role="img" viewBox="0 0 500 500">
        <title>{`${labels.action}, ${labels.vision}, ${labels.harmony}, ${labels.logic}`}</title>
        <path className="fill-destructive/10" d="M30 250A220 220 0 0 1 250 30V250Z" />
        <path className="fill-warning/15" d="M250 30A220 220 0 0 1 470 250H250Z" />
        <path className="fill-success/10" d="M470 250A220 220 0 0 1 250 470V250Z" />
        <path className="fill-primary/10" d="M250 470A220 220 0 0 1 30 250H250Z" />
        {[74, 146, 218].map((radius) => <circle className="fill-none stroke-border" cx="250" cy="250" key={radius} r={radius} strokeDasharray={radius === 218 ? undefined : '4 5'} />)}
        <path className="stroke-border" d="M30 250H470M250 30V470" />
        <text className="fill-destructive text-[12px] font-semibold" x="84" y="82">{labels.action}</text>
        <text className="fill-warning-foreground text-[12px] font-semibold" textAnchor="end" x="416" y="82">{labels.vision}</text>
        <text className="fill-success text-[12px] font-semibold" textAnchor="end" x="416" y="430">{labels.harmony}</text>
        <text className="fill-primary text-[12px] font-semibold" x="84" y="430">{labels.logic}</text>
        {points.map((point) => {
          const x = position(point.x)
          const y = position(-point.y)
          const isInner = point.kind === 'inner'
          return (
            <g key={point.id}>
              <circle className={point.kind === 'team' ? 'fill-foreground stroke-background' : isInner ? 'fill-background stroke-primary' : 'fill-primary stroke-background'} cx={x} cy={y} r={point.kind === 'team' ? 10 : 8} strokeWidth="4" />
              <text className="fill-foreground text-[10px] font-medium" textAnchor="middle" x={x} y={y - 14}>{point.label}</text>
            </g>
          )
        })}
      </svg>
      {(labels.inner || labels.outer) ? <figcaption className="mt-2 flex flex-wrap justify-center gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="size-3 rounded-full border-2 border-primary bg-background" />{labels.inner}</span><span className="flex items-center gap-2"><span className="size-3 rounded-full bg-primary" />{labels.outer}</span></figcaption> : null}
    </figure>
  )
}

export function percentagesToCoordinates(percentages: Record<'ACTION' | 'VISION' | 'HARMONY' | 'LOGIC', number>) {
  return {
    x: ((percentages.ACTION + percentages.VISION) - (percentages.LOGIC + percentages.HARMONY)) / 2,
    y: ((percentages.ACTION + percentages.LOGIC) - (percentages.VISION + percentages.HARMONY)) / 2,
  }
}
