'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { RadioGroup } from '@/components/ui/radio-group'
import { TextInput } from '@/components/ui/text-input'
import type { Locale } from '@/lib/i18n/config'
import type { LeaveRequestPreview } from '@/lib/leave/request-service'

type RequestMode = 'PRIORITY' | 'DIRECT'
type TimeMode = 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | 'SPECIFIC_HOURS'
type EmploymentOption = LeaveRequestPreview['employmentSelection']['options'][number]

type Labels = {
  title: string
  description: string
  employment: string
  employmentRequired: string
  viaPriority: string
  withoutPriority: string
  leaveType: string
  noLeaveTypes: string
  priorityRule: string
  noPriorityRules: string
  currentBalance: string
  projectedBalance: string
  unlimited: string
  timeMode: string
  fullDay: string
  morning: string
  afternoon: string
  specificHours: string
  startDate: string
  endDate: string
  timeStart: string
  timeEnd: string
  totalTime: string
  confirm: string
  cancel: string
  close: string
  loading: string
  success: string
  failed: string
  noBalance: string
  discardTitle: string
  discardDescription: string
  keepEditing: string
  discardChanges: string
}

export function LeaveRequestDialog({
  employeeId,
  startDate,
  initialMode,
  locale,
  labels,
  onClose,
}: {
  employeeId: string
  startDate: string
  initialMode: RequestMode
  locale: Locale
  labels: Labels
  onClose: () => void
}) {
  const [mode, setMode] = useState<RequestMode>(initialMode)
  const [endDate, setEndDate] = useState(startDate)
  const [timeMode, setTimeMode] = useState<TimeMode>('FULL_DAY')
  const [specificStart, setSpecificStart] = useState('09:00')
  const [specificEnd, setSpecificEnd] = useState('17:00')
  const [preview, setPreview] = useState<LeaveRequestPreview | null>(null)
  const [employmentId, setEmploymentId] = useState('')
  const [employmentOptions, setEmploymentOptions] = useState<EmploymentOption[]>([])
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [priorityRuleId, setPriorityRuleId] = useState('')
  const [state, setState] = useState<'loading' | 'selecting' | 'ready' | 'saving' | 'success' | 'error'>('loading')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ employeeId, startDate, mode })
    if (endDate) params.set('endDate', endDate)
    if (employmentId) params.set('employmentId', employmentId)
    fetch(`/api/leave/request/preview?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as unknown
        if (!response.ok) {
          const options = employmentOptionsFromError(body)
          if (response.status === 409 && options.length > 0) {
            setPreview(null)
            setEmploymentOptions(options)
            setState('selecting')
            return
          }
          throw new Error('preview')
        }
        const data = (body as { data: LeaveRequestPreview }).data
        setPreview(data)
        setEmploymentOptions([])
        setLeaveTypeId((current) => current || data.types[0]?.id || '')
        setPriorityRuleId((current) => current || data.priorityRules[0]?.id || '')
        setState('ready')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState('error')
      })
    return () => controller.abort()
  }, [employeeId, startDate, endDate, employmentId, mode])

  const selectedType = useMemo(() => preview?.types.find((type) => type.id === leaveTypeId) ?? null, [leaveTypeId, preview])
  const totalMinutes = timeMode === 'FULL_DAY'
    ? preview?.fullDayMinutes ?? 0
    : timeMode === 'MORNING' || timeMode === 'AFTERNOON'
      ? preview?.halfDayMinutes ?? 0
      : specificMinutes(specificStart, specificEnd)
  const totalHours = (totalMinutes / 60).toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-GB', { maximumFractionDigits: 2 })

  function markDirty(): void {
    setDirty(true)
  }

  function updateEndDate(value: string): void {
    markDirty()
    setState('loading')
    setEndDate(value || startDate)
    if (value !== startDate) setTimeMode('FULL_DAY')
  }

  async function confirm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!preview || state !== 'ready') return
    setState('saving')
    const selectedOption = mode === 'DIRECT' ? leaveTypeId : priorityRuleId
    const idempotencyKey = `${employeeId}:${preview.employmentId}:${startDate}:${endDate}:${mode}:${selectedOption}:${timeMode}:${specificStart}:${specificEnd}`
    try {
      const response = await fetch('/api/leave/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          employmentId: preview.employmentId,
          mode,
          leaveTypeId: mode === 'DIRECT' ? leaveTypeId : null,
          priorityRuleId: mode === 'PRIORITY' ? priorityRuleId : null,
          startDate,
          endDate: endDate || startDate,
          timeMode,
          specificStart: timeMode === 'SPECIFIC_HOURS' ? specificStart : null,
          specificEnd: timeMode === 'SPECIFIC_HOURS' ? specificEnd : null,
          idempotencyKey,
        }),
      })
      if (!response.ok) {
        setState('error')
        return
      }
      setDirty(false)
      setState('success')
    } catch {
      setState('error')
    }
  }

  return (
    <FormDrawer
      cancelLabel={labels.cancel}
      closeLabel={labels.close}
      description={labels.description}
      dirty={dirty && state !== 'success'}
      dirtyProtection={{
        title: labels.discardTitle,
        description: labels.discardDescription,
        discardLabel: labels.discardChanges,
        keepEditingLabel: labels.keepEditing,
      }}
      onDiscard={() => setDirty(false)}
      onOpenChange={(open) => { if (!open) onClose() }}
      onSubmit={(event) => { void confirm(event) }}
      open
      saveLabel={labels.confirm}
      saving={state === 'saving'}
      disabled={state !== 'ready'}
      title={labels.title}
    >
      {state === 'success' ? (
        <p className="rounded-[var(--radius-surface)] bg-success-surface p-4 text-sm font-semibold text-success-foreground" role="status">{labels.success}</p>
      ) : (
        <>
          <RadioGroup
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            legend={labels.title}
            name="leave-request-mode"
            onValueChange={(value) => {
              if (value !== 'PRIORITY' && value !== 'DIRECT') return
              markDirty()
              setState('loading')
              setMode(value)
            }}
            options={[
              { value: 'PRIORITY', label: labels.viaPriority },
              { value: 'DIRECT', label: labels.withoutPriority },
            ]}
            value={mode}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={<TextInput readOnly type="date" value={startDate} />} label={labels.startDate} />
            <FormField control={<TextInput min={startDate} onChange={(event) => updateEndDate(event.currentTarget.value)} type="date" value={endDate} />} label={labels.endDate} />
          </div>

          {employmentOptions.length ? (
            <FormField
              control={(
                <DropdownSelect aria-label={labels.employment} onChange={(event) => { markDirty(); setEmploymentId(event.currentTarget.value); setState('loading') }} placeholder={labels.employmentRequired} searchable searchPlaceholder={labels.employment} value={employmentId}>
                  <option value="">{labels.employmentRequired}</option>
                  {employmentOptions.map((option) => <option key={option.id} value={option.id}>{option.employmentNumber ?? option.id} · {option.startsOn} · {option.administrationName ?? '—'}{option.functionName ? ` · ${option.functionName}` : ''}</option>)}
                </DropdownSelect>
              )}
              label={labels.employment}
            />
          ) : null}

          {mode === 'DIRECT' ? (
            <FormField
              control={(
                <DropdownSelect aria-label={labels.leaveType} onChange={(event) => { markDirty(); setLeaveTypeId(event.currentTarget.value) }} placeholder={labels.noLeaveTypes} searchable searchPlaceholder={labels.leaveType} value={leaveTypeId}>
                  <option value="">{labels.noLeaveTypes}</option>
                  {preview?.types.map((type) => <option key={type.id} value={type.id}>{type.name} — {type.status === 'UNLIMITED' ? labels.unlimited : `${type.currentBalanceHours ?? 0}u ${labels.currentBalance} · ${type.projectedEndBalanceHours ?? 0}u ${labels.projectedBalance}`}</option>)}
                </DropdownSelect>
              )}
              label={labels.leaveType}
            />
          ) : (
            <FormField
              control={(
                <DropdownSelect aria-label={labels.priorityRule} disabled={!preview?.priorityRules.length} onChange={(event) => { markDirty(); setPriorityRuleId(event.currentTarget.value) }} placeholder={labels.noPriorityRules} searchable searchPlaceholder={labels.priorityRule} value={priorityRuleId}>
                  <option value="">{labels.noPriorityRules}</option>
                  {preview?.priorityRules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name} · {rule.itemCount}</option>)}
                </DropdownSelect>
              )}
              label={labels.priorityRule}
            />
          )}

          <RadioGroup
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            legend={labels.timeMode}
            name="leave-request-time-mode"
            onValueChange={(value) => {
              if (value !== 'FULL_DAY' && value !== 'MORNING' && value !== 'AFTERNOON' && value !== 'SPECIFIC_HOURS') return
              markDirty()
              setTimeMode(value)
            }}
            options={[
              { value: 'FULL_DAY', label: labels.fullDay },
              { disabled: endDate !== startDate, value: 'MORNING', label: labels.morning },
              { disabled: endDate !== startDate, value: 'AFTERNOON', label: labels.afternoon },
              { disabled: endDate !== startDate, value: 'SPECIFIC_HOURS', label: labels.specificHours },
            ]}
            value={timeMode}
          />

          {timeMode === 'SPECIFIC_HOURS' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={<TextInput onChange={(event) => { markDirty(); setSpecificStart(event.currentTarget.value) }} type="time" value={specificStart} />} label={labels.timeStart} />
              <FormField control={<TextInput onChange={(event) => { markDirty(); setSpecificEnd(event.currentTarget.value) }} type="time" value={specificEnd} />} label={labels.timeEnd} />
            </div>
          ) : null}

          <div className="rounded-[var(--radius-surface)] border border-border-subtle bg-surface-subtle p-4 text-sm">
            <span className="font-semibold">{labels.totalTime}: </span>{totalHours}u
            {selectedType?.status === 'NO_BALANCE' ? <span className="ml-2 text-destructive">{labels.noBalance}</span> : null}
          </div>
          {state === 'loading' ? <p className="text-sm text-muted-foreground" role="status">{labels.loading}</p> : null}
          {state === 'selecting' ? <p className="text-sm text-muted-foreground" role="status">{labels.employmentRequired}</p> : null}
          {state === 'error' ? <p className="rounded-[var(--radius-surface)] bg-destructive/10 p-4 text-sm text-destructive" role="alert">{labels.failed}</p> : null}
        </>
      )}
    </FormDrawer>
  )
}

function employmentOptionsFromError(value: unknown): EmploymentOption[] {
  if (!value || typeof value !== 'object') return []
  const details = (value as { details?: unknown }).details
  if (!details || typeof details !== 'object') return []
  const options = (details as { options?: unknown }).options
  if (!Array.isArray(options)) return []
  return options.filter(isEmploymentOption)
}

function isEmploymentOption(value: unknown): value is EmploymentOption {
  if (!value || typeof value !== 'object') return false
  const option = value as Record<string, unknown>
  return typeof option.id === 'string'
    && (typeof option.employmentNumber === 'string' || option.employmentNumber === null)
    && typeof option.startsOn === 'string'
    && (typeof option.endsOn === 'string' || option.endsOn === null)
    && (typeof option.administrationName === 'string' || option.administrationName === null)
    && (typeof option.departmentName === 'string' || option.departmentName === null)
    && (typeof option.functionName === 'string' || option.functionName === null)
}

function specificMinutes(start: string, end: string): number {
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  const minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute)
  return minutes > 0 ? minutes : 0
}
