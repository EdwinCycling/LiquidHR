import Link from 'next/link'
import { AlertTriangle, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { getTeamCompassAssessment } from '@/lib/team-compass/service'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { TeamCompassCompass } from './team-compass-compass'

type Assessment = Awaited<ReturnType<typeof getTeamCompassAssessment>>

export type TeamCompassResultLabels = Record<'resultTitle' | 'resultSubtitle' | 'innerStyle' | 'outerRole' | 'energyShift' | 'shiftLow' | 'shiftMedium' | 'shiftHigh' | 'shiftExplanation' | 'strengths' | 'watchouts' | 'communication' | 'backToOverview' | 'dimensionAction' | 'dimensionVision' | 'dimensionHarmony' | 'dimensionLogic' | 'disclaimer' | 'privacyTitle' | 'strengthAction' | 'strengthVision' | 'strengthHarmony' | 'strengthLogic' | 'watchoutAction' | 'watchoutVision' | 'watchoutHarmony' | 'watchoutLogic' | 'communicationAction' | 'communicationVision' | 'communicationHarmony' | 'communicationLogic', string>

export function TeamCompassResult({ initial, labels }: { initial: Assessment; labels: TeamCompassResultLabels }) {
  const profile = initial.profile
  if (!profile) return null
  const dimensions = { ACTION: labels.dimensionAction, VISION: labels.dimensionVision, HARMONY: labels.dimensionHarmony, LOGIC: labels.dimensionLogic }
  const primaryDimension = profile.primary_dimension as keyof typeof dimensions
  const strength = { ACTION: labels.strengthAction, VISION: labels.strengthVision, HARMONY: labels.strengthHarmony, LOGIC: labels.strengthLogic }[primaryDimension]
  const watchout = { ACTION: labels.watchoutAction, VISION: labels.watchoutVision, HARMONY: labels.watchoutHarmony, LOGIC: labels.watchoutLogic }[primaryDimension]
  const communication = { ACTION: labels.communicationAction, VISION: labels.communicationVision, HARMONY: labels.communicationHarmony, LOGIC: labels.communicationLogic }[primaryDimension]
  const shift = profile.shift_band === 'LOW' ? labels.shiftLow : profile.shift_band === 'MEDIUM' ? labels.shiftMedium : labels.shiftHigh
  const scores = [['ACTION', profile.inner_action, profile.outer_action], ['VISION', profile.inner_vision, profile.outer_vision], ['HARMONY', profile.inner_harmony, profile.outer_harmony], ['LOGIC', profile.inner_logic, profile.outer_logic]] as const
  return <PageShell className="space-y-6 py-8" width="wide"><PageHeader description={labels.resultSubtitle} title={labels.resultTitle} /><p className="text-sm font-semibold text-primary">{initial.campaign.name}</p><Surface className="flex gap-3 p-4 text-sm" variant="subtle"><ShieldCheck aria-hidden="true" className="shrink-0 text-primary" size={20} /><p><strong>{labels.privacyTitle}.</strong> {labels.disclaimer}</p></Surface><div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]"><Surface className="p-5"><h2 className="text-xl font-semibold">{dimensions[profile.primary_dimension as keyof typeof dimensions]} + {dimensions[profile.secondary_dimension as keyof typeof dimensions]}</h2><TeamCompassCompass labels={{ action: labels.dimensionAction, vision: labels.dimensionVision, harmony: labels.dimensionHarmony, logic: labels.dimensionLogic, inner: labels.innerStyle, outer: labels.outerRole }} points={[{ id: 'inner', label: labels.innerStyle, kind: 'inner', x: profile.inner_x, y: profile.inner_y }, { id: 'outer', label: labels.outerRole, kind: 'outer', x: profile.outer_x, y: profile.outer_y }]} /><div className="mt-4 grid gap-3 sm:grid-cols-2">{scores.map(([dimension, inner, outer]) => <Surface className="p-3" key={dimension} variant="subtle"><p className="text-sm font-semibold">{dimensions[dimension]}</p><div className="mt-3 space-y-2 text-xs"><ScoreBar label={labels.innerStyle} value={inner} /><ScoreBar label={labels.outerRole} value={outer} /></div></Surface>)}</div></Surface><aside className="space-y-4"><Surface className="p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">{labels.energyShift}</h2><Badge tone="warning">{shift} · {profile.shift_distance}</Badge></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{labels.shiftExplanation.replace('{distance}', String(profile.shift_distance))}</p></Surface><InsightCard icon={<Sparkles aria-hidden="true" size={19} />} title={labels.strengths} text={strength} /><InsightCard icon={<AlertTriangle aria-hidden="true" size={19} />} title={labels.watchouts} text={watchout} /><InsightCard icon={<MessageSquareText aria-hidden="true" size={19} />} title={labels.communication} text={communication} /></aside></div><Link className={buttonClasses({ variant: 'secondary' })} href="/team-compass">{labels.backToOverview}</Link></PageShell>
}

function ScoreBar({ label, value }: { label: string; value: number }) { return <div><div className="flex justify-between"><span>{label}</span><strong>{Math.round(value)}%</strong></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} /></div></div> }
function InsightCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <Surface className="p-5"><div className="flex items-center gap-2 text-primary">{icon}<h2 className="font-semibold text-foreground">{title}</h2></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></Surface> }
