'use client'

import { useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type {
  ConditionNode,
  FieldDefinition,
  FieldType,
  ProcessAction,
  ProcessDefinitionDraft,
  ProcessTransition,
} from '@/lib/process-automation/definition-schemas'

type RuleOperator = 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty'

export interface ConditionalRouteEditorLabels {
  readonly title: string
  readonly add: string
  readonly edit: string
  readonly remove: string
  readonly field: string
  readonly operator: string
  readonly value: string
  readonly whenTrue: string
  readonly otherwise: string
  readonly save: string
  readonly cancel: string
  readonly invalidValue: string
  readonly invalidDestination: string
  readonly missingField: string
  readonly missingDestination: string
  readonly pairInvalid: string
  readonly yes: string
  readonly no: string
  readonly operatorLabels: Readonly<Record<RuleOperator, string>>
}

interface Props {
  readonly draft: ProcessDefinitionDraft
  readonly fromStepKey: string
  readonly editing: boolean
  readonly language: 'nl' | 'en'
  readonly actionLabel: string
  readonly actionLabels: Readonly<Record<ProcessAction, string>>
  readonly labels: ConditionalRouteEditorLabels
  readonly onChangeDraft: (updater: (current: ProcessDefinitionDraft) => ProcessDefinitionDraft) => void
}

interface RulePair {
  readonly yes: ProcessTransition
  readonly otherwise: ProcessTransition
  readonly condition: ConditionNode
}

interface SimpleRule {
  readonly fieldKey: string
  readonly operator: RuleOperator
  readonly value: string
}

const orderableTypes = new Set<FieldType>(['INTEGER', 'DECIMAL', 'MONEY', 'DATE', 'TIME', 'DATETIME'])
const valueTypes = new Set<FieldType>(['SHORT_TEXT', 'LONG_TEXT', 'INTEGER', 'DECIMAL', 'MONEY', 'DATE', 'TIME', 'DATETIME', 'BOOLEAN', 'SINGLE_SELECT'])

function title(value: { readonly nl?: string; readonly en?: string } | undefined, language: 'nl' | 'en'): string {
  return value?.[language]?.trim() || value?.nl?.trim() || value?.en?.trim() || ''
}

function operatorsFor(type: FieldType): RuleOperator[] {
  return [
    ...(orderableTypes.has(type) ? ['greaterThan', 'lessThan'] as const : []),
    'equals', 'notEquals', 'isEmpty', 'isNotEmpty',
  ]
}

function inverse(condition: ConditionNode): ConditionNode {
  return { operator: 'not', condition }
}

function sameCondition(left: ConditionNode | undefined, right: ConditionNode | undefined): boolean {
  return left !== undefined && right !== undefined && JSON.stringify(left) === JSON.stringify(right)
}

function findPairs(transitions: readonly ProcessTransition[]): { readonly pairs: RulePair[]; readonly unmatched: ProcessTransition[] } {
  const consumed = new Set<string>()
  const pairs: RulePair[] = []

  for (const candidate of transitions) {
    if (!candidate.condition || consumed.has(candidate.key)) continue
    const candidateCondition = candidate.condition
    const isOtherwise = candidateCondition.operator === 'not'
    const condition = isOtherwise ? candidateCondition.condition : candidateCondition
    const sameRoute = (route: ProcessTransition) => route.action === candidate.action && route.kind === candidate.kind
    const yes = isOtherwise
      ? transitions.find((route) => !consumed.has(route.key) && route.key !== candidate.key && sameRoute(route) && sameCondition(route.condition, condition))
      : candidate
    const otherwise = isOtherwise
      ? candidate
      : transitions.find((route) => !consumed.has(route.key) && route.key !== candidate.key && sameRoute(route) && sameCondition(route.condition, inverse(condition)))

    if (yes && otherwise) {
      consumed.add(yes.key)
      consumed.add(otherwise.key)
      pairs.push({ yes, otherwise, condition })
    }
  }

  return { pairs, unmatched: transitions.filter((route) => route.condition && !consumed.has(route.key)) }
}

function simpleRule(condition: ConditionNode, fields: readonly FieldDefinition[]): SimpleRule | null {
  if (condition.operator === 'isEmpty' || condition.operator === 'isNotEmpty') {
    if (condition.operand.kind !== 'FIELD') return null
    return { fieldKey: condition.operand.fieldKey, operator: condition.operator, value: '' }
  }
  if (condition.operator !== 'equals' && condition.operator !== 'notEquals' && condition.operator !== 'greaterThan' && condition.operator !== 'lessThan') return null
  const left = condition.left
  const right = condition.right
  if (left.kind !== 'FIELD' || right.kind !== 'LITERAL') return null
  const field = fields.find((candidate) => candidate.key === left.fieldKey)
  if (!field || !valueTypes.has(field.type)) return null
  if (typeof right.value === 'boolean' && field.type !== 'BOOLEAN') return null
  if (typeof right.value === 'number' && !['INTEGER', 'DECIMAL', 'MONEY'].includes(field.type)) return null
  return { fieldKey: field.key, operator: condition.operator, value: right.value === null ? '' : String(right.value) }
}

function parseCondition(field: FieldDefinition, operator: RuleOperator, rawValue: string): ConditionNode | null {
  const operand = { kind: 'FIELD' as const, fieldKey: field.key }
  if (operator === 'isEmpty' || operator === 'isNotEmpty') return { operator, operand }
  if (rawValue.trim() === '') return null
  let value: string | number | boolean = rawValue
  if (field.type === 'INTEGER' || field.type === 'DECIMAL' || field.type === 'MONEY') {
    const numericValue = Number(rawValue)
    if (!Number.isFinite(numericValue) || (field.type === 'INTEGER' && !Number.isInteger(numericValue))) return null
    value = numericValue
  } else if (field.type === 'BOOLEAN') {
    if (rawValue !== 'true' && rawValue !== 'false') return null
    value = rawValue === 'true'
  } else if (field.type === 'SINGLE_SELECT' && !field.options?.some((option) => option.value === rawValue)) {
    return null
  }
  return { operator, left: operand, right: { kind: 'LITERAL', value } }
}

function formatValue(field: FieldDefinition, value: string, language: 'nl' | 'en'): string {
  if (field.type === 'MONEY' && value !== '' && Number.isFinite(Number(value))) {
    return new Intl.NumberFormat(language === 'nl' ? 'nl-NL' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(Number(value))
  }
  if (field.type === 'BOOLEAN') return value === 'true' ? (language === 'nl' ? 'Ja' : 'Yes') : (language === 'nl' ? 'Nee' : 'No')
  if (field.type === 'SINGLE_SELECT') return title(field.options?.find((option) => option.value === value)?.label, language) || value
  return value
}

function uniqueKey(base: string, used: ReadonlySet<string>): string {
  let key = base
  let suffix = 2
  while (used.has(key)) key = `${base}-${suffix++}`
  return key
}

export function ConditionalRouteEditor({ draft, fromStepKey, editing, language, actionLabel, actionLabels, labels, onChangeDraft }: Props) {
  const sourceRoutes = draft.transitions.filter((transition) => transition.fromStepKey === fromStepKey)
  const { pairs, unmatched } = findPairs(sourceRoutes)
  const conditionedActions = new Set(sourceRoutes.filter((route) => route.condition).map((route) => route.action))
  const fields = draft.forms.flatMap((form) => form.sections.flatMap((section) => section.fields)).filter((field) => valueTypes.has(field.type))
  const destinations = draft.steps.filter((step) => step.key !== fromStepKey)
  const actionChoices = [...new Set(sourceRoutes.filter((route) => !route.condition && !conditionedActions.has(route.action)).map((route) => route.action))]
  const initialFieldKey = fields[0]?.key ?? ''
  const initialOperator = fields[0] ? operatorsFor(fields[0].type)[0] ?? 'equals' : 'equals'
  const [editingRule, setEditingRule] = useState(false)
  const [activePairKey, setActivePairKey] = useState<string | null>(null)
  const [routeAction, setRouteAction] = useState<ProcessAction>(actionChoices[0] ?? 'SUBMIT')
  const [fieldKey, setFieldKey] = useState(initialFieldKey)
  const [operator, setOperator] = useState<RuleOperator>(initialOperator)
  const [rawValue, setRawValue] = useState('')
  const [yesStepKey, setYesStepKey] = useState('')
  const [otherwiseStepKey, setOtherwiseStepKey] = useState('')
  const activePair = pairs.find((pair) => pair.yes.key === activePairKey) ?? null
  const selectedField = fields.find((field) => field.key === fieldKey)
  const fieldLabel = selectedField ? title(selectedField.label, language) : ''
  const canStart = destinations.length > 0 && actionChoices.length > 0

  function beginEdit(pair?: RulePair): void {
    const base = pair ? simpleRule(pair.condition, fields) : null
    const nextFieldKey = base?.fieldKey ?? initialFieldKey
    const nextField = fields.find((field) => field.key === nextFieldKey)
    setActivePairKey(pair?.yes.key ?? null)
    setFieldKey(nextField?.key ?? '')
    setRouteAction(pair?.yes.action ?? actionChoices[0] ?? 'SUBMIT')
    setOperator(base?.operator ?? (nextField ? operatorsFor(nextField.type)[0] ?? 'equals' : 'equals'))
    setRawValue(base?.value ?? '')
    setYesStepKey(pair ? (destinations.some((step) => step.key === pair.yes.toStepKey) ? pair.yes.toStepKey : '') : destinations[0]?.key ?? '')
    setOtherwiseStepKey(pair ? (destinations.some((step) => step.key === pair.otherwise.toStepKey) ? pair.otherwise.toStepKey : '') : destinations[1]?.key ?? destinations[0]?.key ?? '')
    setEditingRule(true)
  }

  function onFieldChange(event: ChangeEvent<HTMLSelectElement>): void {
    const nextKey = event.target.value
    const nextField = fields.find((field) => field.key === nextKey)
    setFieldKey(nextKey)
    setOperator(nextField ? operatorsFor(nextField.type)[0] ?? 'equals' : 'equals')
    setRawValue('')
  }

  function saveRule(): void {
    if (!selectedField || !destinations.some((step) => step.key === yesStepKey) || !destinations.some((step) => step.key === otherwiseStepKey)) return
    const condition = parseCondition(selectedField, operator, rawValue)
    if (!condition) return

    onChangeDraft((current) => {
      if (activePair) {
        const currentYes = current.transitions.some((route) => route.key === activePair.yes.key)
        const currentOtherwise = current.transitions.some((route) => route.key === activePair.otherwise.key)
        if (!currentYes || !currentOtherwise) return current
        return {
          ...current,
          transitions: current.transitions.map((route) => route.key === activePair.yes.key
            ? { ...route, toStepKey: yesStepKey, condition }
            : route.key === activePair.otherwise.key
              ? { ...route, toStepKey: otherwiseStepKey, condition: inverse(condition) }
              : route),
        }
      }

      const currentRoutes = current.transitions.filter((route) => route.fromStepKey === fromStepKey)
      if (currentRoutes.some((route) => route.action === routeAction && route.condition)) return current
      const primary = currentRoutes.find((route) => !route.condition && route.action === routeAction)
      if (!primary) return current
      const key = uniqueKey(`${primary.key}-otherwise`, new Set(current.transitions.map((route) => route.key)))
      const yes: ProcessTransition = { ...primary, toStepKey: yesStepKey, condition }
      const otherwise: ProcessTransition = { ...primary, key, toStepKey: otherwiseStepKey, condition: inverse(condition) }
      return { ...current, transitions: current.transitions.map((route) => route.key === primary.key ? yes : route).concat(otherwise) }
    })
    setEditingRule(false)
  }

  function removeRule(pair: RulePair): void {
    onChangeDraft((current) => ({
      ...current,
      transitions: current.transitions.flatMap((route) => {
        if (route.key === pair.otherwise.key) return []
        if (route.key === pair.yes.key) {
          const unconditional = { ...route }
          delete unconditional.condition
          return [unconditional]
        }
        return [route]
      }),
    }))
    if (activePairKey === pair.yes.key) setEditingRule(false)
  }

  function removeUnmatchedRoute(route: ProcessTransition): void {
    onChangeDraft((current) => ({ ...current, transitions: current.transitions.filter((candidate) => candidate.key !== route.key) }))
  }

  const parsed = selectedField ? parseCondition(selectedField, operator, rawValue) : null
  const valueRequired = operator !== 'isEmpty' && operator !== 'isNotEmpty'
  const invalidValue = Boolean(editingRule && selectedField && valueRequired && !parsed)
  const invalidDestination = editingRule && (!destinations.some((step) => step.key === yesStepKey) || !destinations.some((step) => step.key === otherwiseStepKey))
  const shouldShowDestinations = activePair !== null || sourceRoutes.some((route) => !route.condition && route.action === routeAction)

  if (!editingRule && pairs.length === 0 && !canStart && unmatched.length === 0) return null

  return (
    <section aria-label={labels.title} className="mt-4 min-w-0 border-t border-border pt-4">
      <div className="min-w-0">
        <h6 className="font-semibold">{labels.title}</h6>
        {pairs.length > 0 ? <ul className="mt-3 grid gap-3">
          {pairs.map((pair) => {
            const rule = simpleRule(pair.condition, fields)
            const ruleField = rule ? fields.find((field) => field.key === rule.fieldKey) : undefined
            const summary = rule && ruleField
              ? `${title(ruleField.label, language)} ${labels.operatorLabels[rule.operator]}${rule.value !== '' ? ` ${formatValue(ruleField, rule.value, language)}` : ''}`
              : null
            const yesTitle = title(draft.steps.find((step) => step.key === pair.yes.toStepKey)?.title, language)
            const otherwiseTitle = title(draft.steps.find((step) => step.key === pair.otherwise.toStepKey)?.title, language)
            return <li className="border-b border-border pb-3 last:border-b-0 last:pb-0" key={pair.yes.key}>
              <article className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground">{actionLabels[pair.yes.action]}</p>
                    {summary ? <p className="mt-1 break-words text-sm">{summary}</p> : <p className="mt-1 break-words text-sm text-destructive">{labels.missingField}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button disabled={!editing || !rule} onClick={() => beginEdit(pair)} size="sm" type="button" variant="secondary">{labels.edit}</Button>
                    <Button disabled={!editing} onClick={() => removeRule(pair)} size="sm" type="button" variant="ghost">{labels.remove}</Button>
                  </div>
                </div>
                <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
                  <p className="min-w-0 break-words text-sm"><span className="font-semibold">{labels.whenTrue}:</span> {yesTitle || labels.missingDestination}</p>
                  <p className="min-w-0 break-words text-sm"><span className="font-semibold">{labels.otherwise}:</span> {otherwiseTitle || labels.missingDestination}</p>
                </div>
              </article>
            </li>
          })}
        </ul> : null}
      </div>

      {unmatched.length > 0 ? <div className="mt-3 rounded-lg border border-destructive/40 p-3 text-sm text-destructive" role="status">
        <p>{labels.pairInvalid}</p>
        <ul className="mt-2 grid gap-1">
          {unmatched.map((route) => {
            const destination = title(draft.steps.find((step) => step.key === route.toStepKey)?.title, language) || labels.missingDestination
            return <li className="flex min-w-0 flex-wrap items-center justify-between gap-2" key={route.key}>
              <span className="min-w-0 break-words">{actionLabels[route.action]} → {destination}</span>
              <Button aria-label={`${labels.remove}: ${actionLabels[route.action]} → ${destination}`} disabled={!editing} onClick={() => removeUnmatchedRoute(route)} size="sm" type="button" variant="ghost">{labels.remove}</Button>
            </li>
          })}
        </ul>
      </div> : null}

      {!editingRule && canStart ? <Button className="mt-3" disabled={!editing || fields.length === 0} onClick={() => beginEdit()} size="sm" type="button" variant="secondary">{labels.add}</Button> : null}
      {!editingRule && canStart && fields.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{labels.missingField}</p> : null}

      {editingRule && !activePair && actionChoices.length > 1 ? <label className="mt-4 block min-w-0 text-sm font-semibold" htmlFor={`condition-action-${fromStepKey}`}>{actionLabel}
        <DropdownSelect className="mt-1" disabled={!editing} id={`condition-action-${fromStepKey}`} onChange={(event) => setRouteAction(event.target.value as ProcessAction)} value={routeAction}>
          {actionChoices.map((action) => <option key={action} value={action}>{actionLabels[action]}</option>)}
        </DropdownSelect>
      </label> : null}

      {editingRule ? <div className="mt-4 grid min-w-0 gap-3">
        <label className="min-w-0 text-sm font-semibold" htmlFor={`condition-field-${fromStepKey}`}>{labels.field}
          <DropdownSelect className="mt-1" disabled={!editing || fields.length === 0} id={`condition-field-${fromStepKey}`} onChange={onFieldChange} searchable value={fieldKey}>
            <option value="">{labels.field}</option>
            {fields.map((field) => <option key={field.key} value={field.key}>{title(field.label, language)}{field.type === 'MONEY' ? ' · €' : ` · ${field.type}`}</option>)}
          </DropdownSelect>
        </label>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-semibold" htmlFor={`condition-operator-${fromStepKey}`}>{labels.operator}
            <DropdownSelect className="mt-1" disabled={!editing || !selectedField} id={`condition-operator-${fromStepKey}`} onChange={(event) => setOperator(event.target.value as RuleOperator)} value={operator}>
              {(selectedField ? operatorsFor(selectedField.type) : []).map((value) => <option key={value} value={value}>{labels.operatorLabels[value]}</option>)}
            </DropdownSelect>
          </label>
          {valueRequired ? <label className="min-w-0 text-sm font-semibold" htmlFor={`condition-value-${fromStepKey}`}>{labels.value}
            {selectedField?.type === 'BOOLEAN' ? <DropdownSelect className="mt-1" id={`condition-value-${fromStepKey}`} onChange={(event) => setRawValue(event.target.value)} value={rawValue}><option value="">{labels.value}</option><option value="true">{labels.yes}</option><option value="false">{labels.no}</option></DropdownSelect>
              : selectedField?.type === 'SINGLE_SELECT' ? <DropdownSelect className="mt-1" id={`condition-value-${fromStepKey}`} onChange={(event) => setRawValue(event.target.value)} value={rawValue}><option value="">{labels.value}</option>{(selectedField.options ?? []).map((option) => <option key={option.value} value={option.value}>{title(option.label, language)}</option>)}</DropdownSelect>
                : <input aria-invalid={invalidValue} className="mt-1 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal focus-visible:outline-2 focus-visible:outline-primary" id={`condition-value-${fromStepKey}`} inputMode={selectedField && ['INTEGER', 'DECIMAL', 'MONEY'].includes(selectedField.type) ? 'decimal' : undefined} onChange={(event) => setRawValue(event.target.value)} step={selectedField?.type === 'INTEGER' ? '1' : selectedField && ['DECIMAL', 'MONEY'].includes(selectedField.type) ? 'any' : undefined} type={selectedField?.type === 'DATE' ? 'date' : selectedField?.type === 'TIME' ? 'time' : selectedField?.type === 'DATETIME' ? 'datetime-local' : ['INTEGER', 'DECIMAL', 'MONEY'].includes(selectedField?.type ?? '') ? 'number' : 'text'} value={rawValue} />}
          </label> : <div />}
        </div>
        {invalidValue ? <p className="text-sm text-destructive" role="alert">{labels.invalidValue}</p> : null}
        {shouldShowDestinations ? <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {([['yes', labels.whenTrue, yesStepKey, setYesStepKey], ['otherwise', labels.otherwise, otherwiseStepKey, setOtherwiseStepKey]] as const).map(([id, label, value, setValue]) => <label className="min-w-0 text-sm font-semibold" htmlFor={`condition-${id}-${fromStepKey}`} key={id}>{label}
            <DropdownSelect className="mt-1" disabled={!editing} id={`condition-${id}-${fromStepKey}`} onChange={(event) => setValue(event.target.value)} searchable value={value}>
              <option value="">{labels.missingDestination}</option>
              {destinations.map((step) => <option key={step.key} value={step.key}>{title(step.title, language)}</option>)}
            </DropdownSelect>
          </label>)}
        </div> : null}
        {invalidDestination ? <p className="text-sm text-destructive" role="alert">{labels.invalidDestination}</p> : null}
        {selectedField && parsed ? <p aria-live="polite" className="break-words rounded-lg border border-border bg-background px-3 py-2 text-sm">{fieldLabel} {labels.operatorLabels[operator]}{valueRequired ? ` ${formatValue(selectedField, rawValue, language)}` : ''}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!editing || !parsed || invalidValue || invalidDestination} onClick={saveRule} size="sm" type="button" variant="primary">{labels.save}</Button>
          <Button onClick={() => setEditingRule(false)} size="sm" type="button" variant="secondary">{labels.cancel}</Button>
        </div>
      </div> : null}
    </section>
  )
}
