'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import type { LeaveCatalog } from '@/lib/leave/leave-service'

type TriggerType = 'AGE' | 'SENIORITY'
type AwardTiming = 'START_OF_YEAR' | 'ON_TRIGGER_DATE'
type TierDraft = { id: string; thresholdYears: string; bonusAmount: string }
type Labels = {
  title: string
  description: string
  empty: string
  add: string
  tileAge: string
  tileSeniority: string
  name: string
  profile: string
  trigger: string
  age: string
  seniority: string
  timing: string
  startOfYear: string
  onTriggerDate: string
  proRate: string
  proRateHelp: string
  tiers: string
  thresholdYears: string
  bonusAmount: string
  addTier: string
  removeTier: string
  summary: string
  save: string
  cancel: string
  saving: string
  saved: string
  failed: string
  noTiers: string
  current: string
  inactive: string
  fullTime: string
  selectTrigger: string
}

function initialTiers(): TierDraft[] {
  return [{ id: 'tier-1', thresholdYears: '', bonusAmount: '' }]
}

export function LeaveBonusRulesPanel({ catalog, leaveTypeId, labels }: { catalog: LeaveCatalog; leaveTypeId: string; labels: Labels }) {
  const router = useRouter()
  const nextTierId = useRef(2)
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  const [profileId, setProfileId] = useState(catalog.profiles[0]?.id ?? '')
  const [triggerType, setTriggerType] = useState<TriggerType>('AGE')
  const [awardTiming, setAwardTiming] = useState<AwardTiming>('START_OF_YEAR')
  const [proRateFirstYear, setProRateFirstYear] = useState(true)
  const [tiers, setTiers] = useState<TierDraft[]>(initialTiers)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const profileNames = new Map(catalog.profiles.map((profile) => [profile.id, profile.name]))
  const rules = catalog.bonusRules.filter((rule) => rule.leave_type_id === leaveTypeId)
  const currentTriggerTypes = new Set(rules.filter((rule) => rule.leave_profile_id === profileId && rule.is_active).map((rule) => rule.trigger_type))
  const tiersFor = (bonusRuleId: string) => catalog.bonusTiers.filter((tier) => tier.bonus_rule_id === bonusRuleId).sort((left, right) => left.threshold_years - right.threshold_years)

  const reset = () => {
    setName('')
    setProfileId(catalog.profiles[0]?.id ?? '')
    setTriggerType(currentTriggerTypes.has('AGE') ? 'SENIORITY' : 'AGE')
    setAwardTiming('START_OF_YEAR')
    setProRateFirstYear(true)
    setTiers(initialTiers())
    setStatus('idle')
  }

  const save = async () => {
    const normalizedTiers = tiers.map((tier) => ({ thresholdYears: Number(tier.thresholdYears), bonusAmount: Number(tier.bonusAmount) }))
    if (!name.trim() || !profileId || tiers.some((tier) => tier.thresholdYears.trim() === '' || tier.bonusAmount.trim() === '') || normalizedTiers.some((tier) => !Number.isInteger(tier.thresholdYears) || tier.thresholdYears < 0 || !Number.isFinite(tier.bonusAmount) || tier.bonusAmount < 0)) {
      setStatus('failed')
      return
    }
    setStatus('saving')
    try {
      const response = await fetch('/api/leave/catalog', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'BONUS_RULE', leaveProfileId: profileId, leaveTypeId, name: name.trim(), triggerType, awardTiming, proRateFirstYear: awardTiming === 'ON_TRIGGER_DATE' && proRateFirstYear, isActive: true, tiers: normalizedTiers }),
      })
      if (!response.ok) throw new Error('LEAVE_BONUS_SAVE_FAILED')
      setStatus('saved')
      setIsAdding(false)
      router.refresh()
    } catch {
      setStatus('failed')
    }
  }

  const addTier = () => {
    const id = `tier-${nextTierId.current}`
    nextTierId.current += 1
    setTiers((current) => [...current, { id, thresholdYears: '', bonusAmount: '' }])
  }

  return <section className="rounded-2xl border bg-surface p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold">{labels.title}</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{labels.description}</p></div>
      <button className="button-secondary" onClick={() => { reset(); setIsAdding(true) }} type="button">{labels.add}</button>
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {rules.map((rule) => {
        const ruleTiers = tiersFor(rule.id)
        const isAge = rule.trigger_type === 'AGE'
        return <article className="rounded-xl border bg-muted/10 p-5" key={rule.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{isAge ? labels.tileAge : labels.tileSeniority}</p><h3 className="mt-1 text-base font-semibold">{rule.name}</h3></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rule.is_active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>{rule.is_active ? labels.current : labels.inactive}</span></div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{labels.profile}</dt><dd className="mt-1 font-medium">{profileNames.get(rule.leave_profile_id) ?? rule.leave_profile_id}</dd></div><div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{labels.trigger}</dt><dd className="mt-1 font-medium">{isAge ? labels.age : labels.seniority}</dd></div><div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-muted-foreground">{labels.timing}</dt><dd className="mt-1 font-medium">{rule.award_timing === 'START_OF_YEAR' ? labels.startOfYear : labels.onTriggerDate}{rule.pro_rate_first_year && rule.award_timing === 'ON_TRIGGER_DATE' ? ` · ${labels.proRate}` : ''}</dd></div></dl>
          <div className="mt-5 overflow-hidden rounded-lg border"><div className="grid grid-cols-[1fr_auto] gap-3 bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>{labels.thresholdYears}</span><span>{labels.bonusAmount}</span></div>{ruleTiers.map((tier) => <div className="grid grid-cols-[1fr_auto] gap-3 border-t px-3 py-2 text-sm" key={tier.id}><span>{tier.threshold_years}</span><span className="font-medium">{tier.bonus_amount}u</span></div>)}{ruleTiers.length === 0 ? <p className="border-t px-3 py-3 text-sm text-muted-foreground">{labels.noTiers}</p> : null}</div>
        </article>
      })}
    </div>
    {rules.length === 0 ? <div className="mt-5 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{labels.empty}</div> : null}
    {isAdding ? <div aria-label={labels.add} className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-5" role="dialog">
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-semibold">{labels.add}</h3><p className="mt-1 text-sm text-muted-foreground">{labels.selectTrigger}</p></div><button className="text-sm font-semibold text-muted-foreground hover:text-foreground" onClick={() => setIsAdding(false)} type="button">{labels.cancel}</button></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium md:col-span-2">{labels.name}<input className="form-field" maxLength={160} onChange={(event) => setName(event.target.value)} value={name} /></label><label className="grid gap-1.5 text-sm font-medium">{labels.profile}<select className="form-field" onChange={(event) => setProfileId(event.target.value)} value={profileId}>{catalog.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium">{labels.trigger}<select className="form-field" onChange={(event) => setTriggerType(event.target.value as TriggerType)} value={triggerType}><option disabled={currentTriggerTypes.has('AGE')} value="AGE">{labels.age}</option><option disabled={currentTriggerTypes.has('SENIORITY')} value="SENIORITY">{labels.seniority}</option></select></label><label className="grid gap-1.5 text-sm font-medium">{labels.timing}<select className="form-field" onChange={(event) => setAwardTiming(event.target.value as AwardTiming)} value={awardTiming}><option value="START_OF_YEAR">{labels.startOfYear}</option><option value="ON_TRIGGER_DATE">{labels.onTriggerDate}</option></select></label><label className="flex items-center gap-3 self-end text-sm font-medium"><input checked={proRateFirstYear} className="size-4 accent-primary disabled:opacity-60" disabled={awardTiming !== 'ON_TRIGGER_DATE'} onChange={(event) => setProRateFirstYear(event.target.checked)} type="checkbox" />{labels.proRate}</label></div>
      <div className="mt-5 rounded-xl border bg-surface p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold">{labels.tiers}</h4><p className="mt-1 text-xs text-muted-foreground">{labels.bonusAmount} · {labels.fullTime}</p></div><button className="button-secondary" onClick={addTier} type="button">{labels.addTier}</button></div><div className="mt-4 space-y-3">{tiers.map((tier, index) => <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" key={tier.id}><label className="grid gap-1 text-sm font-medium"><span>{labels.thresholdYears}</span><input className="form-field" min="0" max="100" onChange={(event) => setTiers((current) => current.map((item) => item.id === tier.id ? { ...item, thresholdYears: event.target.value } : item))} type="number" value={tier.thresholdYears} /></label><label className="grid gap-1 text-sm font-medium"><span>{labels.bonusAmount}</span><input className="form-field" min="0" step="0.0001" onChange={(event) => setTiers((current) => current.map((item) => item.id === tier.id ? { ...item, bonusAmount: event.target.value } : item))} type="number" value={tier.bonusAmount} /></label>{index > 0 ? <button aria-label={labels.removeTier} className="self-end px-2 py-2 text-sm font-semibold text-destructive" onClick={() => setTiers((current) => current.filter((item) => item.id !== tier.id))} type="button">{labels.removeTier}</button> : <span />}</div>)}</div></div>
      <div className="mt-5 rounded-xl border bg-muted/50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.summary}</p><p className="mt-2 text-sm">{name || '—'} · {triggerType === 'AGE' ? labels.age : labels.seniority} · {tiers.length} {labels.tiers.toLowerCase()}</p></div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><button className="button-primary" disabled={status === 'saving' || currentTriggerTypes.has(triggerType)} onClick={() => void save()} type="button">{status === 'saving' ? labels.saving : labels.save}</button>{status === 'failed' ? <p className="text-sm text-destructive">{labels.failed}</p> : null}</div>
    </div> : null}
    {status === 'saved' ? <p className="mt-4 text-sm text-success">{labels.saved}</p> : null}
  </section>
}
