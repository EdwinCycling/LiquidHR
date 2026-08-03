'use client'

import { Pencil, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { TalentEmployeeCapabilityOptions, TalentEmployeeCapabilityRecord } from '@/lib/talent/employee-capability-service'

type Mode = 'admin' | 'manager' | 'self'
type RecordStatus = 'DRAFT' | 'RELEASED' | 'EXPIRED' | 'ARCHIVED'
type SourceType = 'SELF_ENTERED' | 'HR_ENTERED' | 'MANAGER_ENTERED' | 'IMPORTED'
type EvidenceStatus = 'NOT_PROVIDED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED'

export type TalentEmployeeCapabilityRecordLabels = {
  title: string
  subtitle: string
  add: string
  edit: string
  save: string
  cancel: string
  failed: string
  empty: string
  noResults: string
  search: string
  searchPlaceholder: string
  employee: string
  capability: string
  type: string
  level: string
  languageLevel: string
  nativeLanguage: string
  certificateStatus: string
  certificateIssuer: string
  certificateCode: string
  certificateValidityMonths: string
  renewalRequired: string
  evidenceStatus: string
  evidenceStatusNotProvided: string
  evidenceStatusPending: string
  evidenceStatusVerified: string
  evidenceStatusRejected: string
  evidenceStatusExpired: string
  responsible: string
  responsibleAssigned: string
  responsibleMissing: string
  validFrom: string
  validUntil: string
  source: string
  status: string
  evidence: string
  evidencePresent: string
  noEvidence: string
  readOnly: string
  draftPolicy: string
  all: string
  validityFilter: string
  expiringSoon: string
  archiveImpact: string
  typeCompetency: string
  typeSkill: string
  typeKnowledge: string
  typeLanguage: string
  typeCertificate: string
  statusDraft: string
  statusReleased: string
  statusExpired: string
  statusArchived: string
  sourceSelf: string
  sourceHr: string
  sourceManager: string
  sourceImported: string
  certificateValid: string
  certificateExpired: string
  certificatePermanent: string
  certificateRevoked: string
  close: string
}

type Draft = {
  id: string | null
  version: number | null
  employeeId: string
  capabilityId: string
  talentLevelId: string
  languageLevel: string
  languageIsNative: boolean
  certificateStatus: string
  certificateIssuingBody: string
  certificateCode: string
  certificateValidityMonths: string
  certificateIsPermanent: boolean
  certificateRenewalRequired: boolean
  evidenceStatus: EvidenceStatus | ''
  evidenceDocumentId: string
  qualificationResponsibleAssigned: boolean
  validFrom: string
  validUntil: string
  sourceType: SourceType
  status: RecordStatus
}

type Props = {
  mode: Mode
  initial: TalentEmployeeCapabilityRecord[]
  options?: TalentEmployeeCapabilityOptions
  labels: TalentEmployeeCapabilityRecordLabels
}

type FilterOption = {
  value: string
  label: string
}

type FilterSelectProps = {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
    <span className="truncate">{label}</span>
    <span className="block min-w-0">
      <DropdownSelect aria-label={label} onChange={(event) => onChange(event.target.value)} value={value}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</DropdownSelect>
    </span>
  </label>
}

const levelTypes = new Set(['COMPETENCY', 'SKILL', 'KNOWLEDGE'])

function today() {
  return new Date().toISOString().slice(0, 10)
}

function typeLabel(type: string, labels: TalentEmployeeCapabilityRecordLabels) {
  if (type === 'COMPETENCY') return labels.typeCompetency
  if (type === 'SKILL') return labels.typeSkill
  if (type === 'KNOWLEDGE') return labels.typeKnowledge
  if (type === 'LANGUAGE') return labels.typeLanguage
  return labels.typeCertificate
}

function statusLabel(status: string, labels: TalentEmployeeCapabilityRecordLabels) {
  if (status === 'DRAFT') return labels.statusDraft
  if (status === 'RELEASED') return labels.statusReleased
  if (status === 'EXPIRED') return labels.statusExpired
  return labels.statusArchived
}

function sourceLabel(source: string, labels: TalentEmployeeCapabilityRecordLabels) {
  if (source === 'SELF_ENTERED') return labels.sourceSelf
  if (source === 'MANAGER_ENTERED') return labels.sourceManager
  if (source === 'IMPORTED') return labels.sourceImported
  return labels.sourceHr
}

function certificateStatusLabel(status: string, labels: TalentEmployeeCapabilityRecordLabels) {
  if (status === 'VALID') return labels.certificateValid
  if (status === 'EXPIRED') return labels.certificateExpired
  if (status === 'PERMANENT') return labels.certificatePermanent
  return labels.certificateRevoked
}

function evidenceStatusLabel(status: string, labels: TalentEmployeeCapabilityRecordLabels) {
  if (status === 'PENDING') return labels.evidenceStatusPending
  if (status === 'VERIFIED') return labels.evidenceStatusVerified
  if (status === 'REJECTED') return labels.evidenceStatusRejected
  if (status === 'EXPIRED') return labels.evidenceStatusExpired
  return labels.evidenceStatusNotProvided
}

function isExpiringSoon(validUntil: string | null) {
  if (!validUntil) return false
  const expiry = new Date(`${validUntil}T00:00:00Z`).getTime()
  const now = new Date(`${today()}T00:00:00Z`).getTime()
  const days = (expiry - now) / (24 * 60 * 60 * 1000)
  return days >= 0 && days <= 30
}

function emptyDraft(mode: Mode, options?: TalentEmployeeCapabilityOptions): Draft {
  return {
    id: null,
    version: null,
    employeeId: options?.employees[0]?.id ?? '',
    capabilityId: options?.capabilities[0]?.id ?? '',
    talentLevelId: options?.levels[0]?.id ?? '',
    languageLevel: '',
    languageIsNative: false,
    certificateStatus: 'VALID',
    certificateIssuingBody: '',
    certificateCode: '',
    certificateValidityMonths: '',
    certificateIsPermanent: false,
    certificateRenewalRequired: false,
    evidenceStatus: mode === 'self' ? '' : 'NOT_PROVIDED',
    evidenceDocumentId: '',
    qualificationResponsibleAssigned: false,
    validFrom: today(),
    validUntil: '',
    sourceType: mode === 'self' ? 'SELF_ENTERED' : 'HR_ENTERED',
    status: mode === 'self' ? 'DRAFT' : 'RELEASED',
  }
}

function toDraft(record: TalentEmployeeCapabilityRecord): Draft {
  return {
    id: record.id,
    version: record.version,
    employeeId: record.employeeId,
    capabilityId: record.capabilityId,
    talentLevelId: record.talentLevelId ?? '',
    languageLevel: record.languageLevel ?? '',
    languageIsNative: record.languageIsNative,
    certificateStatus: record.certificateStatus ?? 'VALID',
    certificateIssuingBody: record.certificateIssuingBody ?? '',
    certificateCode: record.certificateCode ?? '',
    certificateValidityMonths: record.certificateValidityMonths?.toString() ?? '',
    certificateIsPermanent: record.certificateIsPermanent,
    certificateRenewalRequired: record.certificateRenewalRequired,
    evidenceStatus: (record.evidenceStatus ?? '') as EvidenceStatus | '',
    evidenceDocumentId: record.evidenceDocumentId ?? '',
    qualificationResponsibleAssigned: record.qualificationResponsibleAssigned,
    validFrom: record.validFrom,
    validUntil: record.validUntil ?? '',
    sourceType: record.sourceType as SourceType,
    status: record.status as RecordStatus,
  }
}

export function TalentEmployeeCapabilityRecords({ mode, initial, options, labels }: Props) {
  const [records, setRecords] = useState(initial)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<RecordStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState('')
  const [validityFilter, setValidityFilter] = useState<'EXPIRING_SOON' | ''>('')
  const [modal, setModal] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase('nl-NL')

  const visible = useMemo(() => records.filter((record) => {
    if (statusFilter && record.status !== statusFilter) return false
    if (typeFilter && record.capabilityType !== typeFilter) return false
    if (validityFilter === 'EXPIRING_SOON' && !isExpiringSoon(record.validUntil)) return false
    if (!normalizedQuery) return true
    return [record.employeeLabel, record.employeeNumber, record.capabilityName, record.capabilityCode, record.talentLevelName, record.languageLevel, record.certificateIssuingBody, record.certificateCode]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase('nl-NL').includes(normalizedQuery))
  }), [normalizedQuery, records, statusFilter, typeFilter, validityFilter])

  const selectedCapability = options?.capabilities.find((capability) => capability.id === modal?.capabilityId)
  const endpoint = mode === 'self' ? '/api/talent/my-capability-records' : '/api/talent/capability-records'

  async function refresh() {
    const response = await fetch(endpoint, { cache: 'no-store' })
    if (!response.ok) { setMessage(labels.failed); return }
    const payload = await response.json() as { data: TalentEmployeeCapabilityRecord[] }
    setRecords(payload.data)
  }

  async function save() {
    if (!modal || !modal.capabilityId || !modal.validFrom || saving) return
    setSaving(true)
    setMessage(null)
    const valueBase = {
      capabilityId: modal.capabilityId,
      talentLevelId: modal.talentLevelId || null,
      languageLevel: modal.languageLevel || null,
      languageIsNative: modal.languageIsNative,
      certificateStatus: modal.certificateStatus || null,
      validFrom: modal.validFrom,
      validUntil: modal.validUntil || null,
      evidenceDocumentId: modal.evidenceDocumentId || null,
    }
    const qualificationBase = {
      ...valueBase,
      certificateIssuingBody: modal.certificateIssuingBody || null,
      certificateCode: modal.certificateCode || null,
      certificateValidityMonths: modal.certificateValidityMonths ? Number(modal.certificateValidityMonths) : null,
      certificateIsPermanent: modal.certificateIsPermanent,
      certificateRenewalRequired: modal.certificateRenewalRequired,
      evidenceStatus: modal.evidenceStatus || null,
    }
    const body = mode === 'self'
      ? (modal.id ? { ...valueBase, version: modal.version } : valueBase)
      : (modal.id
        ? { ...qualificationBase, version: modal.version, status: modal.status }
        : { ...qualificationBase, employeeId: modal.employeeId, sourceType: modal.sourceType, status: modal.status })
    const response = await fetch(modal.id ? `${endpoint}/${modal.id}` : endpoint, { method: modal.id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (!response.ok) { setMessage(labels.failed); return }
    setModal(null)
    await refresh()
  }

  const canEdit = mode === 'self' ? (record: TalentEmployeeCapabilityRecord) => record.sourceType === 'SELF_ENTERED' && record.status === 'DRAFT' : () => mode === 'admin'

  return <section className="mt-8 rounded-2xl border bg-surface p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="eyebrow">{labels.title}</p><h2 className="mt-1 text-xl font-semibold">{labels.title}</h2><p className="mt-2 max-w-3xl text-sm text-muted-foreground">{labels.subtitle}</p></div>
      {mode !== 'manager' ? <button className="button-primary inline-flex items-center gap-2" onClick={() => setModal(emptyDraft(mode, options))} type="button"><Plus size={16} />{labels.add}</button> : null}
    </div>
    <div className="mt-6 rounded-2xl border border-border/80 bg-surface-raised/70 p-3 sm:p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground"><span className="truncate">{labels.search}</span><span className="relative block min-w-0"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input aria-label={labels.search} className="min-h-11 w-full min-w-0 rounded-xl border border-border/90 bg-surface pl-10 pr-3 text-sm font-medium text-foreground shadow-sm transition-[background-color,border-color,box-shadow] placeholder:font-normal placeholder:text-muted-foreground hover:border-primary/40 hover:bg-surface-raised focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus/20" onChange={(event) => setQuery(event.target.value)} placeholder={labels.searchPlaceholder} value={query} /></span></label>
        <FilterSelect label={labels.status} onChange={(value) => setStatusFilter(value as RecordStatus | '')} options={[{ value: '', label: labels.all }, { value: 'DRAFT', label: labels.statusDraft }, { value: 'RELEASED', label: labels.statusReleased }, { value: 'EXPIRED', label: labels.statusExpired }, { value: 'ARCHIVED', label: labels.statusArchived }]} value={statusFilter} />
        <FilterSelect label={labels.validityFilter} onChange={(value) => setValidityFilter(value as 'EXPIRING_SOON' | '')} options={[{ value: '', label: labels.all }, { value: 'EXPIRING_SOON', label: labels.expiringSoon }]} value={validityFilter} />
        <FilterSelect label={labels.type} onChange={setTypeFilter} options={[{ value: '', label: labels.all }, ...['COMPETENCY', 'SKILL', 'KNOWLEDGE', 'LANGUAGE', 'CERTIFICATE'].map((type) => ({ value: type, label: typeLabel(type, labels) }))]} value={typeFilter} />
      </div>
    </div>
    <div className="mt-5 divide-y rounded-xl border">
      {visible.map((record) => <article className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between" key={record.id}>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{record.capabilityName}</h3><span className="rounded-full bg-accent px-2 py-1 text-xs font-medium text-primary">{typeLabel(record.capabilityType, labels)}</span><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">{statusLabel(record.status, labels)}</span></div><p className="mt-1 text-xs text-muted-foreground">{record.capabilityCode}{mode !== 'self' ? ` · ${record.employeeLabel}` : ''}</p><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-muted-foreground">{labels.level}</dt><dd className="mt-1 font-medium">{record.talentLevelName ?? record.languageLevel ?? (record.languageIsNative ? labels.nativeLanguage : record.certificateStatus ? certificateStatusLabel(record.certificateStatus, labels) : '—')}</dd></div><div><dt className="text-muted-foreground">{labels.source}</dt><dd className="mt-1 font-medium">{sourceLabel(record.sourceType, labels)}</dd></div><div><dt className="text-muted-foreground">{labels.validFrom}</dt><dd className="mt-1 font-medium">{record.validFrom}</dd></div><div><dt className="text-muted-foreground">{labels.validUntil}</dt><dd className="mt-1 font-medium">{record.validUntil ?? '—'}</dd></div></dl><p className="mt-3 text-xs text-muted-foreground">{labels.evidence}: {record.evidenceDocumentId ? labels.evidencePresent : labels.noEvidence}</p></div>
        {canEdit(record) ? <button aria-label={`${labels.edit}: ${record.capabilityName}`} className="button-secondary inline-flex w-fit items-center gap-2" onClick={() => setModal(toDraft(record))} type="button"><Pencil size={15} />{labels.edit}</button> : null}
      </article>)}
      {visible.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{records.length > 0 ? labels.noResults : labels.empty}</p> : null}
    </div>
    {mode === 'manager' ? <p className="mt-4 text-xs text-muted-foreground">{labels.readOnly}</p> : null}
    {message ? <p aria-live="polite" className="mt-4 text-sm text-destructive">{message}</p> : null}

    {modal ? <div aria-labelledby="talent-record-dialog-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-surface p-5 shadow-xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{labels.title}</p><h2 className="mt-1 text-xl font-semibold" id="talent-record-dialog-title">{modal.id ? labels.edit : labels.add}</h2></div><button aria-label={labels.close} className="button-secondary px-3" onClick={() => setModal(null)} type="button">×</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">
      {mode === 'admin' ? <label className="sm:col-span-2"><span className="form-label">{labels.employee}</span><DropdownSelect aria-label={labels.employee} onChange={(event) => setModal({ ...modal, employeeId: event.target.value })} value={modal.employeeId}><option value="">{labels.employee}</option>{options?.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.label} · {employee.employeeNumber}</option>)}</DropdownSelect></label> : null}
      <label className="sm:col-span-2"><span className="form-label">{labels.capability}</span><DropdownSelect aria-label={labels.capability} onChange={(event) => { const capability = options?.capabilities.find((item) => item.id === event.target.value); setModal({ ...modal, capabilityId: event.target.value, talentLevelId: options?.levels[0]?.id ?? '', languageLevel: '', languageIsNative: false, certificateStatus: 'VALID', certificateIssuingBody: '', certificateCode: '', certificateValidityMonths: '', certificateIsPermanent: false, certificateRenewalRequired: false, evidenceStatus: capability?.capability_type === 'CERTIFICATE' ? 'NOT_PROVIDED' : '', evidenceDocumentId: '', qualificationResponsibleAssigned: false }) }} value={modal.capabilityId}><option value="">{labels.capability}</option>{options?.capabilities.map((capability) => <option key={capability.id} value={capability.id}>{capability.name} · {typeLabel(capability.capability_type, labels)}</option>)}</DropdownSelect></label>
      {selectedCapability && levelTypes.has(selectedCapability.capability_type) ? <label><span className="form-label">{labels.level}</span><DropdownSelect aria-label={labels.level} onChange={(event) => setModal({ ...modal, talentLevelId: event.target.value })} value={modal.talentLevelId}><option value="">{labels.level}</option>{options?.levels.map((level) => <option key={level.id} value={level.id}>{level.code} · {level.name}</option>)}</DropdownSelect></label> : null}
      {selectedCapability?.capability_type === 'LANGUAGE' ? <><label><span className="form-label">{labels.languageLevel}</span><DropdownSelect aria-label={labels.languageLevel} onChange={(event) => setModal({ ...modal, languageLevel: event.target.value })} value={modal.languageLevel}><option value="">{labels.languageLevel}</option>{['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => <option key={level} value={level}>{level}</option>)}</DropdownSelect></label><label className="flex items-center gap-2 self-end pb-2"><input checked={modal.languageIsNative} onChange={(event) => setModal({ ...modal, languageIsNative: event.target.checked })} type="checkbox" />{labels.nativeLanguage}</label></> : null}
      {selectedCapability?.capability_type === 'CERTIFICATE' ? <><label><span className="form-label">{labels.certificateStatus}</span><DropdownSelect aria-label={labels.certificateStatus} onChange={(event) => setModal({ ...modal, certificateStatus: event.target.value, certificateIsPermanent: event.target.value === 'PERMANENT', validUntil: event.target.value === 'PERMANENT' ? '' : modal.validUntil })} value={modal.certificateStatus}><option value="VALID">{labels.certificateValid}</option><option value="EXPIRED">{labels.certificateExpired}</option><option value="PERMANENT">{labels.certificatePermanent}</option><option value="REVOKED">{labels.certificateRevoked}</option></DropdownSelect></label>{mode === 'admin' ? <><label><span className="form-label">{labels.certificateIssuer}</span><input className="form-field" maxLength={200} onChange={(event) => setModal({ ...modal, certificateIssuingBody: event.target.value })} value={modal.certificateIssuingBody} /></label><label><span className="form-label">{labels.certificateCode}</span><input className="form-field" maxLength={120} onChange={(event) => setModal({ ...modal, certificateCode: event.target.value })} value={modal.certificateCode} /></label><label><span className="form-label">{labels.certificateValidityMonths}</span><input className="form-field" min={1} max={1200} onChange={(event) => setModal({ ...modal, certificateValidityMonths: event.target.value })} type="number" value={modal.certificateValidityMonths} /></label><label className="flex items-center gap-2 self-end pb-2"><input checked={modal.certificateRenewalRequired} onChange={(event) => setModal({ ...modal, certificateRenewalRequired: event.target.checked })} type="checkbox" />{labels.renewalRequired}</label><label><span className="form-label">{labels.evidenceStatus} ({evidenceStatusLabel(modal.evidenceStatus || 'NOT_PROVIDED', labels)})</span><DropdownSelect aria-label={labels.evidenceStatus} onChange={(event) => setModal({ ...modal, evidenceStatus: event.target.value as EvidenceStatus })} value={modal.evidenceStatus}><option value="NOT_PROVIDED">{labels.evidenceStatusNotProvided}</option><option value="PENDING">{labels.evidenceStatusPending}</option><option value="VERIFIED">{labels.evidenceStatusVerified}</option><option value="REJECTED">{labels.evidenceStatusRejected}</option><option value="EXPIRED">{labels.evidenceStatusExpired}</option></DropdownSelect></label><div><span className="form-label">{labels.responsible}</span><p className="form-field text-sm">{modal.qualificationResponsibleAssigned ? labels.responsibleAssigned : labels.responsibleMissing}</p></div></> : null}</> : null}
      <label><span className="form-label">{labels.validFrom}</span><input className="form-field" onChange={(event) => setModal({ ...modal, validFrom: event.target.value })} type="date" value={modal.validFrom} /></label><label><span className="form-label">{labels.validUntil}</span><input className="form-field" onChange={(event) => setModal({ ...modal, validUntil: event.target.value })} type="date" value={modal.validUntil} /></label>
      {mode === 'admin' ? <><label><span className="form-label">{labels.source}</span><DropdownSelect aria-label={labels.source} disabled={Boolean(modal.id)} onChange={(event) => setModal({ ...modal, sourceType: event.target.value as SourceType })} value={modal.sourceType}><option value="HR_ENTERED">{labels.sourceHr}</option><option value="IMPORTED">{labels.sourceImported}</option></DropdownSelect></label><label><span className="form-label">{labels.status}</span><DropdownSelect aria-label={labels.status} onChange={(event) => setModal({ ...modal, status: event.target.value as RecordStatus })} value={modal.status}><option value="DRAFT">{labels.statusDraft}</option><option value="RELEASED">{labels.statusReleased}</option><option value="ARCHIVED">{labels.statusArchived}</option></DropdownSelect></label></> : null}
    </div>{modal.status === 'ARCHIVED' ? <p className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-muted-foreground">{labels.archiveImpact}</p> : null}<p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">{labels.draftPolicy}</p><div className="mt-6 flex justify-end gap-3"><button className="button-secondary" onClick={() => setModal(null)} type="button">{labels.cancel}</button><button className="button-primary" disabled={saving} onClick={() => void save()} type="button">{saving ? `${labels.save}…` : labels.save}</button></div></div></div> : null}
  </section>
}
