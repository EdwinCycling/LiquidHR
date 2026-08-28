'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'
import { TextInput } from '@/components/ui/text-input'
import { FormField } from '@/components/patterns/form-field'

interface CaseManagerOption {
  id: string
  employeeNumber: string
  name: string
}

interface AbsenceSettingsLabels {
  threshold: string
  thresholdHelp: string
  caseManager: string
  caseManagerHelp: string
  noCaseManager: string
  save: string
  saving: string
  saved: string
  failed: string
  invalid: string
  employeeSelfReport: string
  employeeSelfReportHelp: string
}

export function AbsenceSettingsForm({
  frequentAbsenceThreshold,
  defaultCaseManagerEmployeeId,
  employeeSelfReportEnabled,
  caseManagers,
  labels,
}: {
  frequentAbsenceThreshold: number
  defaultCaseManagerEmployeeId: string | null
  employeeSelfReportEnabled: boolean
  caseManagers: CaseManagerOption[]
  labels: AbsenceSettingsLabels
}) {
  const router = useRouter()
  const [threshold, setThreshold] = useState(String(frequentAbsenceThreshold))
  const [caseManager, setCaseManager] = useState(defaultCaseManagerEmployeeId ?? '')
  const [selfReport, setSelfReport] = useState(employeeSelfReportEnabled)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed' | 'invalid'>('idle')

  async function save() {
    setStatus('saving')
    const response = await fetch('/api/settings/absence', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        frequentAbsenceThreshold: Number(threshold),
        defaultCaseManagerEmployeeId: caseManager || null,
        employeeSelfReportEnabled: selfReport,
      }),
    })
    if (response.ok) {
      setStatus('saved')
      router.refresh()
      return
    }
    const body = await response.json().catch(() => null) as { error?: string } | null
    setStatus(body?.error === 'ABSENCE_SETTINGS_INPUT_INVALID' || body?.error === 'ABSENCE_SETTINGS_CASE_MANAGER_INVALID' ? 'invalid' : 'failed')
  }

  return (
    <div className="space-y-5">
      <Surface className="grid gap-5 p-5">
        <FormField control={<TextInput max={20} min={1} onChange={(event) => setThreshold(event.target.value)} type="number" value={threshold} />} description={labels.thresholdHelp} label={labels.threshold} required />
        <FormField control={<DropdownSelect aria-label={labels.caseManager} onChange={(event) => setCaseManager(event.target.value)} searchable searchPlaceholder={labels.caseManager} value={caseManager}><option value="">{labels.noCaseManager}</option>{caseManagers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name} · {manager.employeeNumber}</option>)}</DropdownSelect>} description={labels.caseManagerHelp} label={labels.caseManager} />
        <Switch checked={selfReport} description={labels.employeeSelfReportHelp} label={labels.employeeSelfReport} onChange={(event) => setSelfReport(event.target.checked)} />
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-subtle pt-4">
          {status === 'saved' ? <span className="inline-flex items-center gap-2 text-sm font-medium text-success" role="status"><Check size={16} />{labels.saved}</span> : null}
          {status === 'failed' ? <span className="text-sm font-medium text-destructive" role="alert">{labels.failed}</span> : null}
          {status === 'invalid' ? <span className="text-sm font-medium text-destructive" role="alert">{labels.invalid}</span> : null}
          <Button loading={status === 'saving'} onClick={() => void save()} type="button">{status === 'saving' ? labels.saving : labels.save}</Button>
        </div>
      </Surface>
    </div>
  )
}
