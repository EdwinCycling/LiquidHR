'use client'

import { useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { ComponentEditorPayload, ComponentEditorMethodPayload } from '@/lib/payroll/component-editor-contract'
import type { ComponentEditorState } from '@/lib/payroll/component-editor-state'
import type { ComponentEditorValidationResult } from '@/lib/payroll/component-editor-engine'
import type { PayrollValueType } from '@liquid-hr/payroll-engine'
import {
  previewComponentDraftAction,
  saveComponentDraftAction,
  validateComponentDraftAction,
} from '@/app/(dashboard)/payroll-components/actions'

export interface ComponentEditorPackageOption {
  readonly compositionId: string
  readonly packageId: string
  readonly version: string
}

export interface ComponentEditorDependencyOption {
  readonly componentCode: string
  readonly outputName: string
  readonly valueType: PayrollValueType
  readonly label: string
}

interface ComponentEditorProps {
  readonly initial: ComponentEditorState
  readonly canSave: boolean
  readonly readOnly?: boolean
  readonly ownershipLabel: string
  readonly provenanceLabel: string
  readonly sourcePath?: string
  readonly packageOptions: readonly ComponentEditorPackageOption[]
  readonly dependencyOptions: readonly ComponentEditorDependencyOption[]
  readonly labels: Readonly<Record<string, string>>
}

const VALIDATION_ISSUE_KEYS: Readonly<Record<string, string>> = {
  COMPONENT_EFFECTIVE_DATE_INVALID: 'payrollComponentsEditorIssueDate',
  COMPONENT_EFFECTIVE_RANGE_INVALID: 'payrollComponentsEditorIssueDate',
  COMPONENT_VERSION_STALE: 'payrollComponentsEditorIssueStaleVersion',
  PAYROLL_COMPONENT_DRAFT_VERSION_STALE: 'payrollComponentsEditorIssueStaleVersion',
  DEPENDENCY_COMPONENT_UNKNOWN: 'payrollComponentsEditorIssueDependency',
  DEPENDENCY_INPUT_UNKNOWN: 'payrollComponentsEditorIssueDependency',
  DEPENDENCY_OUTPUT_UNKNOWN: 'payrollComponentsEditorIssueDependency',
  DEPENDENCY_VERSION_MISSING: 'payrollComponentsEditorIssueDependency',
  DEPENDENCY_VERSION_AMBIGUOUS: 'payrollComponentsEditorIssueDependency',
  DEPENDENCY_TYPE_MISMATCH: 'payrollComponentsEditorIssueDependency',
  DEPENDENCY_SCOPE_MISMATCH: 'payrollComponentsEditorIssueDependency',
  DEPENDENCY_CYCLE: 'payrollComponentsEditorIssueCycle',
  DIVISION_BY_ZERO: 'payrollComponentsEditorIssueDivisionByZero',
  DECIMAL_DIVISION_ROUNDING_REQUIRED: 'payrollComponentsEditorIssueRounding',
  EXPRESSION_OUTPUT_TYPE_MISMATCH: 'payrollComponentsEditorIssueType',
  FORMULA_INVALID: 'payrollComponentsEditorIssueFormula',
  FORMULA_OUTPUT_MISMATCH: 'payrollComponentsEditorIssueFormula',
  PAYROLL_COMPONENT_DRAFT_CODE_DUPLICATE: 'payrollComponentsEditorIssueCodeDuplicate',
  PAYROLL_COMPONENT_DRAFT_VERSION_CONFLICT: 'payrollComponentsEditorIssueStaleVersion',
  PAYROLL_COMPONENT_DRAFT_IDEMPOTENCY_CONFLICT: 'payrollComponentsEditorIssueStaleVersion',
  PAYROLL_COMPONENT_DRAFT_SAVE_FAILED: 'payrollComponentsEditorIssueGeneric',
}

function defaultPreviewValue(valueType: PayrollValueType): string | boolean {
  switch (valueType) {
    case 'BOOLEAN': return false
    case 'STRING': return 'TEST'
    case 'PERCENTAGE': return '0.01'
    case 'MONEY': return '100.00'
    case 'DECIMAL': return '1'
  }
}

function methodForOutputs(kind: ComponentEditorMethodPayload['kind'], state: ComponentEditorState): ComponentEditorMethodPayload {
  if (kind === 'source') return { kind: 'source' }
  if (kind === 'passThrough') {
    const firstInput = state.inputs[0]?.name ?? ''
    return { kind, outputs: Object.fromEntries(state.outputs.map((output) => [output.name, firstInput])) }
  }
  if (kind === 'aggregate') return { kind, operation: 'SUM', inputNames: state.inputs.map((input) => input.name) }
  return {
    kind: 'expression',
    formulas: Object.fromEntries(state.outputs.map((output) => [
      output.name,
      output.valueType === 'BOOLEAN' ? 'false' : output.valueType === 'STRING' ? '""' : `${output.valueType}(0)`,
    ])),
  }
}

function displayValue(value: string | boolean): string {
  return typeof value === 'boolean' ? String(value) : value
}

export function ComponentEditor({
  initial,
  canSave,
  readOnly = false,
  ownershipLabel,
  provenanceLabel,
  sourcePath,
  packageOptions,
  dependencyOptions,
  labels,
}: ComponentEditorProps) {
  const [state, setState] = useState<ComponentEditorState>(initial)
  const [result, setResult] = useState<ComponentEditorValidationResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const requestId = useRef<string | null>(null)
  const router = useRouter()
  const label = (key: string) => labels[key] ?? key
  const formatIssues = (issues: readonly string[]) => issues.map((issue) => (
    label(VALIDATION_ISSUE_KEYS[issue] ?? 'payrollComponentsEditorIssueGeneric')
  )).join(' ')
  function update<K extends keyof ComponentEditorState>(key: K, value: ComponentEditorState[K]): void {
    requestId.current = null
    setState((current) => ({ ...current, [key]: value }))
    setResult(null)
    setMessage(null)
  }

  function setMethod(method: ComponentEditorMethodPayload): void {
    update('method', method)
  }

  function addDependency(): void {
    const firstOption = dependencyOptions[0]
    const firstInput = state.inputs[0]
    if (!firstOption || !firstInput) return
    update('dependencies', [...state.dependencies, {
      componentCode: firstOption.componentCode,
      outputName: firstOption.outputName,
      inputName: firstInput.name,
    }])
  }

  function validationPayload(): ComponentEditorPayload {
    return { ...state, requestId: requestId.current ?? crypto.randomUUID() }
  }

  function runValidation(preview: boolean): void {
    const payload = validationPayload()
    startTransition(async () => {
      try {
        const response = preview
          ? await previewComponentDraftAction(payload)
          : await validateComponentDraftAction(payload)
        setResult(response)
        setMessage(response.valid ? null : formatIssues(response.issues))
      } catch {
        setResult(null)
        setMessage(label('payrollComponentsEditorActionFailed'))
      }
    })
  }

  function save(): void {
    const payload = validationPayload()
    requestId.current = payload.requestId
    startTransition(async () => {
      try {
        const response = await saveComponentDraftAction(payload)
        if (!response.ok) {
          setMessage(formatIssues(response.issues))
          return
        }
        const query = new URLSearchParams({ component: `draft::${response.draftId}`, ownership: 'customer', edit: '1', saved: '1' })
        router.push(`/payroll-components?${query.toString()}`)
      } catch {
        setMessage(label('payrollComponentsEditorSaveFailed'))
      }
    })
  }

  function setFormula(outputName: string, formula: string): void {
    if (state.method.kind !== 'expression') return
    setMethod({ ...state.method, formulas: { ...state.method.formulas, [outputName]: formula } })
  }

  function setPassThroughOutput(outputName: string, inputName: string): void {
    if (state.method.kind !== 'passThrough') return
    setMethod({ kind: 'passThrough', outputs: { ...state.method.outputs, [outputName]: inputName } })
  }

  function setAggregate(method: 'operation', value: 'SUM' | 'MIN' | 'MAX'): void
  function setAggregate(method: 'inputNames', value: string[]): void
  function setAggregate(method: 'operation' | 'inputNames', value: 'SUM' | 'MIN' | 'MAX' | string[]): void {
    if (state.method.kind !== 'aggregate') return
    setMethod(method === 'operation'
      ? { kind: 'aggregate', operation: value as 'SUM' | 'MIN' | 'MAX', inputNames: [...state.method.inputNames] }
      : { kind: 'aggregate', operation: state.method.operation, inputNames: value as string[] })
  }

  function outputFormula(output: ComponentEditorState['outputs'][number]): string {
    return output.valueType === 'BOOLEAN' ? 'false' : output.valueType === 'STRING' ? '""' : `${output.valueType}(0)`
  }

  function updateOutputs(outputs: ComponentEditorState['outputs']): void {
    const method = state.method
    if (method.kind === 'expression') {
      const formulas = Object.fromEntries(outputs.map((output, index) => {
        const previousName = state.outputs[index]?.name
        return [output.name, method.formulas[output.name] ?? (previousName ? method.formulas[previousName] : undefined) ?? outputFormula(output)]
      }))
      setMethod({ kind: 'expression', formulas })
    } else if (method.kind === 'passThrough') {
      const outputsByName = Object.fromEntries(outputs.map((output, index) => {
        const previousName = state.outputs[index]?.name
        return [output.name, method.outputs[output.name] ?? (previousName ? method.outputs[previousName] : undefined) ?? state.inputs[0]?.name ?? '']
      }))
      setMethod({ kind: 'passThrough', outputs: outputsByName })
    }
    update('outputs', outputs)
  }

  return <fieldset disabled={readOnly} className="m-0 min-w-0 space-y-4 border-0 p-0">
    <Surface className="space-y-6 p-4 sm:p-6">
      <section aria-labelledby="component-editor-general" className="space-y-4">
        <h3 className="text-base font-semibold text-foreground" id="component-editor-general">{label('payrollComponentsEditorGeneral')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={label('payrollComponentsEditorName')}>
            <TextInput maxLength={120} onChange={(event) => update('displayName', event.target.value)} required value={state.displayName} />
          </Field>
          <Field help={label('payrollComponentsEditorCodeHelp')} label={label('payrollComponentsEditorCode')}>
            <TextInput maxLength={64} onChange={(event) => update('displayCode', event.target.value)} required value={state.displayCode} />
          </Field>
          <Field label={label('payrollComponentsEditorCategory')}>
            <TextInput maxLength={80} onChange={(event) => update('category', event.target.value)} required value={state.category} />
          </Field>
          <Field label={label('payrollComponentsEditorScope')}>
            <DropdownSelect onChange={(event) => update('processingScope', event.target.value as ComponentEditorState['processingScope'])} value={state.processingScope}>
              {['EMPLOYMENT', 'PAYROLL_RUN', 'INCOME_RELATIONSHIP', 'ASSESSMENT_BASE_GROUP', 'EMPLOYEE', 'PAYROLL_PERIOD', 'EMPLOYER'].map((scope) => <option key={scope} value={scope}>{label(`payrollComponentsScope_${scope}`)}</option>)}
            </DropdownSelect>
          </Field>
          <Field label={label('payrollComponentsEditorEffectiveFrom')}>
            <TextInput onChange={(event) => update('effectiveFrom', event.target.value)} required type="date" value={state.effectiveFrom} />
          </Field>
          <Field label={label('payrollComponentsEditorEffectiveTo')}>
            <TextInput onChange={(event) => update('effectiveTo', event.target.value || null)} type="date" value={state.effectiveTo ?? ''} />
          </Field>
          <Field className="sm:col-span-2" label={label('payrollComponentsEditorDescription')}>
            <textarea className="min-h-24 w-full rounded-[var(--radius-control)] border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-focus" maxLength={800} onChange={(event) => update('description', event.target.value)} value={state.description} />
          </Field>
          {!state.draftId ? <Field className="sm:col-span-2" label={label('payrollComponentsEditorCalculationContext')}>
            <DropdownSelect onChange={(event) => update('packageCompositionId', event.target.value)} value={state.packageCompositionId}>
              {packageOptions.map((option) => <option key={option.compositionId} value={option.compositionId}>{option.packageId}{option.version ? ` · ${option.version}` : ''}</option>)}
            </DropdownSelect>
          </Field> : null}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span>{label('payrollComponentsEditorOwnership')}: {ownershipLabel}</span>
          {provenanceLabel ? <span>{label('payrollComponentsEditorProvenance')}: {provenanceLabel}</span> : null}
          {sourcePath ? <span>{label('payrollComponentsEditorSourceMethod')}: <code className="break-all">{sourcePath}</code> ({label('payrollComponentsEditorReadOnly')})</span> : null}
        </div>
      </section>

      <fieldset disabled={state.method.kind === 'source'} className="m-0 space-y-5 border-0 p-0">
      <section aria-labelledby="component-editor-inputs" className="space-y-3 border-t border-border-subtle pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground" id="component-editor-inputs">{label('payrollComponentsEditorInputs')}</h3>
          <Button onClick={() => update('inputs', [...state.inputs, { name: `input_${state.inputs.length + 1}`, valueType: 'MONEY', required: true }])} type="button" variant="secondary">{label('payrollComponentsEditorAddInput')}</Button>
        </div>
        {state.inputs.length ? <div className="space-y-3">{state.inputs.map((input, index) => <div className="grid gap-3 rounded-[var(--radius-surface)] border border-border-subtle p-3 sm:grid-cols-[minmax(8rem,1fr)_minmax(9rem,1fr)_auto_auto] sm:items-end" key={`${input.name}-${index}`}>
          <Field label={label('payrollComponentsEditorInputName')}><TextInput onChange={(event) => {
            const next = [...state.inputs]; next[index] = { ...input, name: event.target.value }; update('inputs', next)
            update('dependencies', state.dependencies.map((dependency) => dependency.inputName === input.name ? { ...dependency, inputName: event.target.value } : dependency))
          }} value={input.name} /></Field>
          <Field label={label('payrollComponentsEditorValueType')}><ValueTypeSelect label={label} value={input.valueType} onChange={(valueType) => update('inputs', state.inputs.map((item, itemIndex) => itemIndex === index ? { ...item, valueType } : item))} /></Field>
          <label className="flex min-h-10 items-center gap-2 text-sm text-foreground"><input checked={input.required} onChange={(event) => update('inputs', state.inputs.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.target.checked } : item))} type="checkbox" />{label('payrollComponentsEditorRequired')}</label>
          <Button onClick={() => {
            const next = state.inputs.filter((_, itemIndex) => itemIndex !== index)
            update('inputs', next)
            update('dependencies', state.dependencies.filter((dependency) => dependency.inputName !== input.name))
          }} type="button" variant="ghost">{label('payrollComponentsEditorRemove')}</Button>
        </div>)}</div> : <p className="text-sm text-muted-foreground">{label('payrollComponentsEditorNoInputs')}</p>}
        <p className="text-xs text-muted-foreground">{label('payrollComponentsEditorValueTypeHelp')}</p>
      </section>

      <section aria-labelledby="component-editor-outputs" className="space-y-3 border-t border-border-subtle pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground" id="component-editor-outputs">{label('payrollComponentsEditorOutputs')}</h3>
          <Button disabled={state.method.kind === 'aggregate'} onClick={() => updateOutputs([...state.outputs, { name: `output_${state.outputs.length + 1}`, valueType: 'MONEY' }])} type="button" variant="secondary">{label('payrollComponentsEditorAddOutput')}</Button>
        </div>
        {state.outputs.map((output, index) => <div className="grid gap-3 rounded-[var(--radius-surface)] border border-border-subtle p-3 sm:grid-cols-[minmax(8rem,1fr)_minmax(9rem,1fr)_auto] sm:items-end" key={`${output.name}-${index}`}>
          <Field label={label('payrollComponentsEditorOutputName')}><TextInput onChange={(event) => updateOutputs(state.outputs.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} value={output.name} /></Field>
          <Field label={label('payrollComponentsEditorValueType')}><ValueTypeSelect label={label} value={output.valueType} onChange={(valueType) => updateOutputs(state.outputs.map((item, itemIndex) => itemIndex === index ? { ...item, valueType } : item))} /></Field>
          <Button disabled={state.outputs.length <= 1 || state.method.kind === 'aggregate'} onClick={() => updateOutputs(state.outputs.filter((_, itemIndex) => itemIndex !== index))} type="button" variant="ghost">{label('payrollComponentsEditorRemove')}</Button>
          <div className="sm:col-span-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground"><input checked={Boolean(output.rounding)} onChange={(event) => updateOutputs(state.outputs.map((item, itemIndex) => {
              if (itemIndex !== index) return item
              const next = { ...item }
              if (event.target.checked) next.rounding = { scale: 2, mode: 'HALF_UP' }
              else delete next.rounding
              return next
            }))} type="checkbox" />{label('payrollComponentsEditorUseRounding')}</label>
            {output.rounding ? <div className="mt-2 flex flex-wrap gap-3">
              <Field label={label('payrollComponentsEditorDecimalPlaces')}><TextInput max={12} min={0} onChange={(event) => updateOutputs(state.outputs.map((item, itemIndex) => itemIndex === index && item.rounding ? { ...item, rounding: { ...item.rounding, scale: Number(event.target.value) } } : item))} type="number" value={output.rounding.scale} /></Field>
              <Field label={label('payrollComponentsEditorRoundingMode')}><DropdownSelect onChange={(event) => updateOutputs(state.outputs.map((item, itemIndex) => itemIndex === index && item.rounding ? { ...item, rounding: { ...item.rounding, mode: event.target.value as NonNullable<typeof item.rounding>['mode'] } } : item))} value={output.rounding.mode}>
                {['HALF_UP', 'HALF_EVEN', 'DOWN', 'UP'].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </DropdownSelect></Field>
            </div> : null}
          </div>
        </div>)}
      </section>

      <section aria-labelledby="component-editor-dependencies" className="space-y-3 border-t border-border-subtle pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground" id="component-editor-dependencies">{label('payrollComponentsEditorDependencies')}</h3>
          <Button disabled={!dependencyOptions.length || !state.inputs.length} onClick={addDependency} type="button" variant="secondary">{label('payrollComponentsEditorAddDependency')}</Button>
        </div>
        {state.dependencies.length ? <div className="space-y-3">{state.dependencies.map((dependency, index) => <div className="grid gap-3 rounded-[var(--radius-surface)] border border-border-subtle p-3 sm:grid-cols-[minmax(10rem,1.5fr)_minmax(8rem,1fr)_auto] sm:items-end" key={`${dependency.inputName}-${index}`}>
          <Field label={label('payrollComponentsEditorComponentOutput')}><DropdownSelect onChange={(event) => {
            const option = dependencyOptions.find((candidate) => `${candidate.componentCode}::${candidate.outputName}` === event.target.value)
            if (!option) return
            update('dependencies', state.dependencies.map((item, itemIndex) => itemIndex === index ? { ...item, componentCode: option.componentCode, outputName: option.outputName } : item))
          }} value={`${dependency.componentCode}::${dependency.outputName}`}>
            {dependencyOptions.map((option) => <option key={`${option.componentCode}::${option.outputName}`} value={`${option.componentCode}::${option.outputName}`}>{option.label}</option>)}
          </DropdownSelect></Field>
          <Field label={label('payrollComponentsEditorInputName')}><DropdownSelect onChange={(event) => update('dependencies', state.dependencies.map((item, itemIndex) => itemIndex === index ? { ...item, inputName: event.target.value } : item))} value={dependency.inputName}>
            {state.inputs.map((input) => <option key={input.name} value={input.name}>{input.name} · {input.valueType}</option>)}
          </DropdownSelect></Field>
          <Button onClick={() => update('dependencies', state.dependencies.filter((_, itemIndex) => itemIndex !== index))} type="button" variant="ghost">{label('payrollComponentsEditorRemove')}</Button>
        </div>)}</div> : <p className="text-sm text-muted-foreground">{label('payrollComponentsEditorNoDependencies')}</p>}
      </section>

      <section aria-labelledby="component-editor-calculation" className="space-y-4 border-t border-border-subtle pt-5">
        <h3 className="text-base font-semibold text-foreground" id="component-editor-calculation">{label('payrollComponentsEditorCalculation')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={label('payrollComponentsEditorMethod')}>
            <DropdownSelect disabled={state.method.kind === 'source'} onChange={(event) => setMethod(methodForOutputs(event.target.value as ComponentEditorMethodPayload['kind'], state))} value={state.method.kind}>
              {state.method.kind === 'source' ? <option value="source">{label('payrollComponentsMethod_source')}</option> : null}
              <option value="passThrough">{label('payrollComponentsMethod_passThrough')}</option>
              <option value="expression">{label('payrollComponentsMethod_expression')}</option>
              <option value="aggregate">{label('payrollComponentsMethod_aggregate')}</option>
            </DropdownSelect>
          </Field>
          <Field label={label('payrollComponentsEditorTracePolicy')}>
            <DropdownSelect onChange={(event) => update('tracePolicy', event.target.value as ComponentEditorState['tracePolicy'])} value={state.tracePolicy}>
              {['FULL', 'OUTPUTS', 'NONE'].map((policy) => <option key={policy} value={policy}>{label(`payrollComponentsEditorTracePolicy_${policy}`)}</option>)}
            </DropdownSelect>
          </Field>
        </div>
        {state.method.kind === 'source' ? <p className="text-sm text-muted-foreground" role="note">{label('payrollComponentsEditorSourceMethodReadOnly')}</p> : null}
        {state.method.kind === 'expression' ? <div className="space-y-3">{state.outputs.map((output) => <Field help={label('payrollComponentsEditorFormulaHelp')} key={output.name} label={`${output.name} · ${label('payrollComponentsEditorFormula')}`}>
          <textarea className="min-h-24 w-full rounded-[var(--radius-control)] border border-border-subtle bg-surface px-3 py-2 font-mono text-sm text-foreground focus-visible:outline-2 focus-visible:outline-focus" maxLength={1200} onChange={(event) => setFormula(output.name, event.target.value)} value={state.method.kind === 'expression' ? state.method.formulas[output.name] ?? '' : ''} />
        </Field>)}</div> : null}
        {state.method.kind === 'passThrough' ? <div className="space-y-3">{state.outputs.map((output) => <Field key={output.name} label={`${output.name} ← ${label('payrollComponentsEditorInputName')}`}>
          <DropdownSelect onChange={(event) => setPassThroughOutput(output.name, event.target.value)} value={state.method.kind === 'passThrough' ? state.method.outputs[output.name] ?? '' : ''}>
            <option value="">{label('payrollComponentsEditorSelectInput')}</option>
            {state.inputs.map((input) => <option key={input.name} value={input.name}>{input.name} · {input.valueType}</option>)}
          </DropdownSelect>
        </Field>)}</div> : null}
        {state.method.kind === 'aggregate' ? <div className="grid gap-3 sm:grid-cols-2">
          <Field label={label('payrollComponentsEditorAggregateOperation')}><DropdownSelect onChange={(event) => setAggregate('operation', event.target.value as 'SUM' | 'MIN' | 'MAX')} value={state.method.operation}>{['SUM', 'MIN', 'MAX'].map((operation) => <option key={operation} value={operation}>{operation}</option>)}</DropdownSelect></Field>
          <Field label={label('payrollComponentsEditorAggregateInputs')}><TextInput onChange={(event) => setAggregate('inputNames', event.target.value.split(',').map((name) => name.trim()).filter(Boolean))} value={state.method.inputNames.join(', ')} /></Field>
        </div> : null}
      </section>

      <section aria-labelledby="component-editor-parameters" className="space-y-3 border-t border-border-subtle pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground" id="component-editor-parameters">{label('payrollComponentsEditorParameters')}</h3>
          <Button onClick={() => update('parameters', [...state.parameters, { name: `parameter_${state.parameters.length + 1}`, valueType: 'DECIMAL', value: '0' }])} type="button" variant="secondary">{label('payrollComponentsEditorAddParameter')}</Button>
        </div>
        {state.parameters.length ? <div className="space-y-3">{state.parameters.map((parameter, index) => <div className="grid gap-3 rounded-[var(--radius-surface)] border border-border-subtle p-3 sm:grid-cols-[minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_auto] sm:items-end" key={`${parameter.name}-${index}`}>
          <Field label={label('payrollComponentsEditorParameterName')}><TextInput onChange={(event) => update('parameters', state.parameters.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} value={parameter.name} /></Field>
          <Field label={label('payrollComponentsEditorValueType')}><ValueTypeSelect label={label} value={parameter.valueType} onChange={(valueType) => update('parameters', state.parameters.map((item, itemIndex) => itemIndex === index ? { ...item, valueType, value: valueType === 'BOOLEAN' ? false : typeof item.value === 'boolean' ? '' : item.value } : item))} /></Field>
          <Field label={label('payrollComponentsEditorParameterValue')}>
            {parameter.valueType === 'BOOLEAN' ? <DropdownSelect onChange={(event) => update('parameters', state.parameters.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value === 'true' } : item))} value={String(parameter.value)}><option value="true">true</option><option value="false">false</option></DropdownSelect>
              : <TextInput onChange={(event) => update('parameters', state.parameters.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} value={displayValue(parameter.value)} />}
          </Field>
          <Button onClick={() => update('parameters', state.parameters.filter((_, itemIndex) => itemIndex !== index))} type="button" variant="ghost">{label('payrollComponentsEditorRemove')}</Button>
        </div>)}</div> : <p className="text-sm text-muted-foreground">{label('payrollComponentsEditorNoParameters')}</p>}
      </section>
      </fieldset>

      <section aria-labelledby="component-editor-preview" className="space-y-3 border-t border-border-subtle pt-5">
        <h3 className="text-base font-semibold text-foreground" id="component-editor-preview">{label('payrollComponentsEditorPreviewInputs')}</h3>
        {state.method.kind === 'source' ? state.outputs.map((output) => <PreviewInput key={output.name} name={output.name} valueType={output.valueType} value={state.previewInputs[output.name] ?? defaultPreviewValue(output.valueType)} label={label} onChange={(value) => update('previewInputs', { ...state.previewInputs, [output.name]: value })} />)
          : state.inputs.length ? state.inputs.map((input) => <PreviewInput key={input.name} name={input.name} valueType={input.valueType} value={state.previewInputs[input.name] ?? defaultPreviewValue(input.valueType)} label={label} onChange={(value) => update('previewInputs', { ...state.previewInputs, [input.name]: value })} />)
            : <p className="text-sm text-muted-foreground">{label('payrollComponentsEditorNoPreviewInputs')}</p>}
        <p className="text-xs text-muted-foreground">{label('payrollComponentsEditorPreviewInputHelp')}</p>
      </section>

      {message ? <Surface className="border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{message}</Surface> : null}
      <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-5">
        <Button disabled={pending} onClick={() => runValidation(false)} type="button" variant="secondary">{label('payrollComponentsEditorValidate')}</Button>
        <Button disabled={pending} onClick={() => runValidation(true)} type="button" variant="secondary">{label('payrollComponentsEditorRunPreview')}</Button>
        <Button disabled={!canSave || pending} onClick={save} type="button">{label('payrollComponentsEditorSaveDraft')}</Button>
      </div>
    </Surface>

    {result?.result ? <Surface className="space-y-5 p-4 sm:p-6" aria-live="polite">
      <div>
        <h3 className="text-base font-semibold text-foreground">{label('payrollComponentsEditorResult')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{label('payrollComponentsEditorCalculationMethod')}: {label(`payrollComponentsMethod_${result.result.method}`)} · {label('payrollComponentsEditorStatus')}: {label(result.result.status === 'CALCULATED' ? 'payrollComponentsEditorCalculated' : 'payrollComponentsEditorBlocked')}</p>
      </div>
      {result.result.formulas.length || result.result.parameters.length ? <div className="grid gap-4 sm:grid-cols-2">
        {result.result.formulas.length ? <div><h4 className="text-sm font-semibold text-foreground">{label('payrollComponentsEditorFormula')}</h4><dl className="mt-2 space-y-2">{result.result.formulas.map((formula) => <div key={formula.outputName}><dt className="text-xs text-muted-foreground">{formula.outputName}</dt><dd className="break-all font-mono text-xs text-foreground">{formula.formula}</dd></div>)}</dl></div> : null}
        {result.result.parameters.length ? <div><h4 className="text-sm font-semibold text-foreground">{label('payrollComponentsEditorParameters')}</h4><dl className="mt-2 space-y-2">{result.result.parameters.map((parameter) => <div className="flex justify-between gap-3 text-xs" key={parameter.name}><dt className="text-muted-foreground">{parameter.name} · {label(`payrollComponentsValueType_${parameter.valueType}`)}</dt><dd className="break-all font-mono text-foreground">{displayValue(parameter.value)}</dd></div>)}</dl></div> : null}
      </div> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {result.result.outputs.map((output) => <div className="rounded-[var(--radius-surface)] border border-border-subtle p-3" key={output.name}>
          <p className="text-xs text-muted-foreground">{output.name} · {output.valueType}</p>
          <p className="mt-1 break-all text-lg font-semibold text-foreground">{displayValue(output.value)}</p>
        </div>)}
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">{label('payrollComponentsEditorTrace')}</h4>
        {result.result.trace.map((step) => <div className="rounded-[var(--radius-surface)] border border-border-subtle p-3" key={`${step.sequence}-${step.componentCode}`}>
          <p className="font-mono text-xs text-muted-foreground">{step.sequence}. {step.componentCode} · v{step.version}</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <TraceValues title={label('payrollComponentsEditorInputs')} values={step.inputs} />
            <TraceValues title={label('payrollComponentsEditorOutputs')} values={step.outputs} />
          </div>
          {step.dependencyRefs.length ? <p className="mt-2 break-words text-xs text-muted-foreground">{label('payrollComponentsEditorDependencies')}: {step.dependencyRefs.map((dependency) => `${dependency.componentCode}.${dependency.outputName} → ${dependency.inputName}`).join(', ')}</p> : null}
        </div>)}
      </div>
      {result.result.rounding.length ? <div><h4 className="text-sm font-semibold text-foreground">{label('payrollComponentsEditorRounding')}</h4><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{result.result.rounding.map((rounding) => <li key={`${rounding.componentCode}.${rounding.outputName}`}>{rounding.outputName}: {rounding.mode} · {rounding.scale} {label('payrollComponentsEditorDecimalPlaces')}</li>)}</ul></div> : null}
      {result.result.controls.length ? <div><h4 className="text-sm font-semibold text-foreground">{label('payrollComponentsEditorControls')}</h4><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{result.result.controls.map((control) => <li key={control.code}>{control.code}: {control.status}</li>)}</ul></div> : null}
    </Surface> : null}
  </fieldset>
}

function Field({ children, label, help, className }: { readonly children: ReactNode; readonly label: string; readonly help?: string; readonly className?: string }) {
  return <label className={`block min-w-0 space-y-1.5 ${className ?? ''}`}>
    <span className="block text-xs font-medium text-muted-foreground">{label}</span>
    {children}
    {help ? <span className="block text-xs text-muted-foreground">{help}</span> : null}
  </label>
}

function ValueTypeSelect({ value, onChange, label }: { readonly value: PayrollValueType; readonly onChange: (value: PayrollValueType) => void; readonly label: (key: string) => string }) {
  return <DropdownSelect onChange={(event) => onChange(event.target.value as PayrollValueType)} value={value}>
    {(['MONEY', 'DECIMAL', 'PERCENTAGE', 'BOOLEAN', 'STRING'] as const).map((valueType) => <option key={valueType} value={valueType}>{label(`payrollComponentsValueType_${valueType}`)}</option>)}
  </DropdownSelect>
}

function PreviewInput({ name, valueType, value, label, onChange }: {
  readonly name: string
  readonly valueType: PayrollValueType
  readonly value: string | boolean
  readonly label: (key: string) => string
  readonly onChange: (value: string | boolean) => void
}) {
  return <div className="grid gap-2 py-1 sm:grid-cols-[minmax(9rem,1fr)_minmax(10rem,1fr)] sm:items-center">
    <span className="text-sm text-foreground">{name} · {valueType}</span>
    {valueType === 'BOOLEAN' ? <DropdownSelect onChange={(event) => onChange(event.target.value === 'true')} value={String(value)}><option value="true">true</option><option value="false">false</option></DropdownSelect>
      : <TextInput aria-label={`${label('payrollComponentsEditorPreviewInput')} ${name}`} onChange={(event) => onChange(event.target.value)} value={displayValue(value)} />}
  </div>
}

function TraceValues({ title, values }: { readonly title: string; readonly values: Readonly<Record<string, { readonly valueType: string; readonly value: string | boolean }>> }) {
  const entries = Object.entries(values)
  return <div>
    <p className="text-xs font-medium text-muted-foreground">{title}</p>
    {entries.length ? <dl className="mt-1 space-y-1">{entries.map(([name, value]) => <div className="flex flex-wrap justify-between gap-x-3 text-xs" key={name}><dt className="text-muted-foreground">{name} · {value.valueType}</dt><dd className="break-all font-mono text-foreground">{displayValue(value.value)}</dd></div>)}</dl> : <p className="mt-1 text-xs text-muted-foreground">—</p>}
  </div>
}
