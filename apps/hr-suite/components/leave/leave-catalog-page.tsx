'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, Palette, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { LeaveCatalog } from '@/lib/leave/leave-service'
import { LEAVE_COLOR_OPTIONS, colorCodeToCssValue } from '@/lib/leave/colors'
import { ActionMenu } from '@/components/ui/action-menu'
import { Button, buttonClasses } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { ScrollableTabs, TabButton } from '@/components/patterns/scrollable-tabs'
import { LeaveAccrualRuleDialog, type LeaveAccrualRuleDialogLabels } from './leave-accrual-rule-dialog'
import { presentManagerApproval } from './leave-approval-presentation'
import { profilesUsingLeaveType } from './leave-rule-presentation'
import type { AccrualRuleEditorLabels } from './accrual-rule-editor'

type Tab = 'leave' | 'overtime' | 'workHours'
export type LeaveCatalogLabels = {
  addType: string
  addWorkHour: string
  addOvertime: string
  priorityRules: string
  showInactive: string
  empty: string
  emptyDescription: string
  active: string
  inactive: string
  tabs: Record<Tab, string>
  columns: { name: string; accrual: string; expiry: string; approval: string; category: string; profiles: string; actions: string }
  approvalYes: string
  approvalNo: string
  perYear: string
  unlimited: string
  annualFteCap: string
  overtime: string
  noExpiry: string
  yearEnd: string
  monthsAfterYear: string
  notConfigured: string
  moreActions: string
  contractHours: string
  workedHours: string
  payrollPeriod: string
  fourWeekly: string
  monthly: string
  yearly: string
  accrualMode: string
  profilesUsing: string
  noProfileUsage: string
  editType: string
  linkToProfile: string
  colorOverview: string
  colorOverviewDescription: string
  usedBy: string
  noColorUsage: string
  colorUnused: string
  colorOptions: Record<string, string>
  ruleDialog: LeaveAccrualRuleDialogLabels
  ruleEditor: AccrualRuleEditorLabels
  tabsAriaLabel?: string
  tabsLeft?: string
  tabsRight?: string
}

function resolveTab(value: string | null): Tab { return value === 'overtime' || value === 'workHours' ? value : 'leave' }

export function LeaveCatalogPage({ initial, labels }: { initial: LeaveCatalog; labels: LeaveCatalogLabels }) {
  const router = useRouter(); const pathname = usePathname(); const searchParams = useSearchParams(); const [showInactive, setShowInactive] = useState(false); const [colorOverviewOpen, setColorOverviewOpen] = useState(false); const [linkLeaveTypeId, setLinkLeaveTypeId] = useState<string | null>(null); const tab = resolveTab(searchParams.get('tab'))
  const changeTab = (nextTab: Tab) => { const params = new URLSearchParams(searchParams.toString()); if (nextTab === 'leave') params.delete('tab'); else params.set('tab', nextTab); router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`) }
  const rows = useMemo(() => { if (tab === 'leave') return initial.leaveTypes.filter((item) => showInactive || item.is_active).map((item) => ({ id: item.id, name: item.name, colorCode: item.color_code, active: item.is_active, category: null, href: `/settings/leave-accrual/types/${item.id}`, entitlement: item.entitlement_mode, rule: initial.accrualRules.filter((rule) => rule.leave_type_id === item.id).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0] })); const category = tab === 'overtime' ? 'OVERTIME' : undefined; return initial.workHourTypes.filter((item) => (category ? item.category === category : item.category !== 'OVERTIME') && (showInactive || item.is_active)).map((item) => ({ id: item.id, name: item.name, colorCode: item.color_code, active: item.is_active, category: item.category, href: `/settings/leave-accrual/work-hours/${item.id}`, entitlement: null, rule: null })) }, [initial, showInactive, tab])
  const addHref = tab === 'leave' ? '/settings/leave-accrual/types/new' : '/settings/leave-accrual/work-hours/new'; const addLabel = tab === 'leave' ? labels.addType : tab === 'overtime' ? labels.addOvertime : labels.addWorkHour; const addUrl = tab === 'overtime' ? `${addHref}?category=OVERTIME` : addHref
  const colorUsage = useMemo(() => { const usage = new Map<string, string[]>(); for (const item of [...initial.leaveTypes.map((type) => ({ name: type.name, color: type.color_code })), ...initial.workHourTypes.map((type) => ({ name: type.name, color: type.color_code }))]) { const color = colorCodeToCssValue(item.color); usage.set(color, [...(usage.get(color) ?? []), item.name]) } return usage }, [initial])
  return <div className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><ScrollableTabs ariaLabel={labels.tabsAriaLabel ?? labels.moreActions} leftLabel={labels.tabsLeft ?? labels.moreActions} rightLabel={labels.tabsRight ?? labels.moreActions}><div role="tablist" aria-label={labels.tabsAriaLabel ?? labels.moreActions}>{(Object.keys(labels.tabs) as Tab[]).map((item) => <TabButton active={tab === item} aria-controls={`leave-tab-panel-${item}`} key={item} onClick={() => changeTab(item)}>{tab === item ? <Check aria-hidden="true" className="mr-1.5 inline size-4" /> : null}{labels.tabs[item]} ({item === 'leave' ? initial.leaveTypes.length : item === 'overtime' ? initial.workHourTypes.filter((type) => type.category === 'OVERTIME').length : initial.workHourTypes.filter((type) => type.category !== 'OVERTIME').length})</TabButton>)}</div></ScrollableTabs><div className="flex flex-wrap items-center gap-2"><Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/settings/leave-accrual/priority-rules">{labels.priorityRules}</Link><Link className={buttonClasses({ size: 'sm' })} href={addUrl}><Plus aria-hidden="true" />{addLabel}</Link><ActionMenu label={labels.moreActions} items={[{ id: 'colors', label: labels.colorOverview, icon: <Palette aria-hidden="true" />, onSelect: () => setColorOverviewOpen(true) }]} /></div></div><DataTableShell caption={labels.tabs[tab]} state={rows.length === 0 ? 'empty' : 'ready'} stateContent={<EmptyState description={labels.emptyDescription} title={labels.empty} />}><thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3 font-semibold">{labels.columns.name}</th><th className="px-5 py-3 font-semibold">{labels.columns.accrual}</th><th className="px-5 py-3 font-semibold">{labels.columns.expiry}</th><th className="px-5 py-3 font-semibold">{tab === 'leave' ? labels.columns.approval : labels.columns.category}</th>{tab === 'leave' ? <><th className="px-5 py-3 font-semibold">{labels.columns.profiles}</th><th className="px-5 py-3 font-semibold">{labels.columns.actions}</th></> : null}</tr></thead><tbody className="divide-y divide-border-subtle">{rows.map((row) => { const rule = row.rule; const leaveType = initial.leaveTypes.find((type) => type.id === row.id); const profiles = tab === 'leave' ? profilesUsingLeaveType(initial, row.id).map((profile) => profile.name) : []; const mode = row.entitlement === 'ACCRUAL' ? labels.accrualMode : row.entitlement === 'UNLIMITED' ? labels.unlimited : row.entitlement === 'ANNUAL_HOURS_CAP' ? labels.perYear : row.entitlement === 'ANNUAL_HOURS_FTE_CAP' ? labels.annualFteCap : row.entitlement === 'OVERTIME_HOURS' ? labels.overtime : null; const accrual = row.entitlement === 'ANNUAL_HOURS_CAP' ? `${labels.perYear}: ${String(leaveType?.annual_hours_cap ?? '')}u` : row.entitlement === 'ANNUAL_HOURS_FTE_CAP' ? `${labels.annualFteCap}: ${String(leaveType?.annual_hours_fte_cap ?? '')}u` : row.entitlement === 'OVERTIME_HOURS' ? labels.overtime : rule ? `${rule.accrual_basis === 'CONTRACT_HOURS' ? labels.contractHours : labels.workedHours} · ${rule.accrual_frequency === 'PAYROLL_PERIOD' ? labels.payrollPeriod : rule.accrual_frequency === 'FOUR_WEEKLY' ? labels.fourWeekly : rule.accrual_frequency === 'MONTHLY' ? labels.monthly : labels.yearly}` : labels.notConfigured; const expiry = rule ? (rule.expiration_months === 0 ? labels.yearEnd : labels.monthsAfterYear.replace('{months}', String(rule.expiration_months))) : tab === 'leave' ? labels.notConfigured : labels.noExpiry; return <tr className={row.active ? '' : 'opacity-60'} key={row.id}><td className="px-5 py-4 align-top"><Link className="flex items-center gap-3 font-semibold text-primary hover:underline" href={row.href}><span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: colorCodeToCssValue(row.colorCode) }} />{row.name}</Link><span className="mt-1 block text-xs text-muted-foreground">{row.active ? labels.active : labels.inactive}</span></td><td className="px-5 py-4 align-top text-muted-foreground"><div className="font-medium text-foreground">{mode ?? labels.notConfigured}</div><div className="mt-1">{accrual}</div></td><td className="px-5 py-4 align-top text-muted-foreground">{expiry}</td><td className="px-5 py-4 align-top">{tab === 'leave' ? <span className="text-muted-foreground">{presentManagerApproval(leaveType?.requires_manager_approval, { yes: labels.approvalYes, no: labels.approvalNo, notConfigured: labels.notConfigured })}</span> : <span className="text-muted-foreground">{row.category === 'INFORMATIONAL' ? labels.columns.category : row.category === 'REGULAR_WORK' ? labels.contractHours : labels.workedHours}</span>}</td>{tab === 'leave' ? <><td className="px-5 py-4 align-top"><div className="text-sm font-medium">{labels.profilesUsing}</div>{profiles.length > 0 ? <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">{profiles.map((profile) => <li key={profile}>{profile}</li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">{labels.noProfileUsage}</p>}</td><td className="px-5 py-4 align-top"><div className="flex flex-wrap gap-2"><Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={row.href}>{labels.editType}</Link><Button disabled={!row.active} onClick={() => setLinkLeaveTypeId(row.id)} size="sm" type="button">{labels.linkToProfile}</Button></div></td></> : null}</tr> })}</tbody></DataTableShell><Checkbox checked={showInactive} label={labels.showInactive} onChange={(event) => setShowInactive(event.target.checked)} /><Dialog closeLabel={labels.moreActions} description={labels.colorOverviewDescription} onOpenChange={setColorOverviewOpen} open={colorOverviewOpen} title={labels.colorOverview}><div className="grid gap-3 sm:grid-cols-2">{LEAVE_COLOR_OPTIONS.map((option) => { const names = colorUsage.get(option.value) ?? []; return <div className="rounded-[var(--radius-control)] border border-subtle p-3" key={option.value}><div className="flex items-center gap-2"><span aria-hidden="true" className="size-4 rounded-full" style={{ backgroundColor: option.value }} /><span className="text-sm font-semibold">{labels.colorOptions[option.labelKey]}</span></div><p className="mt-2 text-xs text-muted-foreground">{names.length > 0 ? `${labels.usedBy}: ${names.join(', ')}` : labels.colorUnused}</p></div> })}</div></Dialog><LeaveAccrualRuleDialog catalog={initial} initialLeaveTypeId={linkLeaveTypeId ?? undefined} key={linkLeaveTypeId ?? 'closed'} labels={labels.ruleDialog} onOpenChange={(nextOpen) => { if (!nextOpen) setLinkLeaveTypeId(null) }} onSaved={() => { setLinkLeaveTypeId(null); router.refresh() }} open={linkLeaveTypeId !== null} ruleEditorLabels={labels.ruleEditor} selectProfile /></div>
}
