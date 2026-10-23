'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import {
  ConditionRuleBuilder,
  conditionBuilderFieldTypes,
  conditionToSimpleRule,
  formatConditionRule,
  operatorsForFieldType,
  simpleRuleToCondition,
  type RuleOperator,
  type SimpleConditionRule,
} from '@/components/process-automation/condition-rule-builder'
import type {
  ConditionNode,
  ProcessAction,
  ProcessDefinitionDraft,
  ProcessTransition,
} from '@/lib/process-automation/definition-schemas'

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
  readonly addValue: string
  readonly removeValue: string
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

function title(value: { readonly nl?: string; readonly en?: string } | undefined, language: 'nl' | 'en'): string {
  return value?.[language]?.trim() || value?.nl?.trim() || value?.en?.trim() || ''
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
  const fields = draft.forms.flatMap((form) => form.sections.flatMap((section) => section.fields)).filter((field) => conditionBuilderFieldTypes.has(field.type))
  const destinations = draft.steps.filter((step) => step.key !== fromStepKey)
  const actionChoices = [...new Set(sourceRoutes.filter((route) => !route.condition && !conditionedActions.has(route.action)).map((route) => route.action))]
  const initialFieldKey = fields[0]?.key ?? ''
  const [editingRule, setEditingRule] = useState(false)
  const [activePairKey, setActivePairKey] = useState<string | null>(null)
  const [routeAction, setRouteAction] = useState<ProcessAction>(actionChoices[0] ?? 'SUBMIT')
  const [ruleDraft, setRuleDraft] = useState<SimpleConditionRule>({ fieldKey: initialFieldKey, operator: fields[0] ? operatorsForFieldType(fields[0].type)[0] ?? 'equals' : 'equals', value: '', values: [] })
  const [yesStepKey, setYesStepKey] = useState('')
  const [otherwiseStepKey, setOtherwiseStepKey] = useState('')
  const activePair = pairs.find((pair) => pair.yes.key === activePairKey) ?? null
  const selectedField = fields.find((field) => field.key === ruleDraft.fieldKey)
  const canStart = destinations.length > 0 && actionChoices.length > 0

  function beginEdit(pair?: RulePair): void {
    const base = pair ? conditionToSimpleRule(pair.condition, fields) : null
    const nextFieldKey = base?.fieldKey ?? initialFieldKey
    const nextField = fields.find((field) => field.key === nextFieldKey)
    setActivePairKey(pair?.yes.key ?? null)
    setRuleDraft(base ?? { fieldKey: nextField?.key ?? '', operator: nextField ? operatorsForFieldType(nextField.type)[0] ?? 'equals' : 'equals', value: '', values: [] })
    setRouteAction(pair?.yes.action ?? actionChoices[0] ?? 'SUBMIT')
    setYesStepKey(pair ? (destinations.some((step) => step.key === pair.yes.toStepKey) ? pair.yes.toStepKey : '') : destinations[0]?.key ?? '')
    setOtherwiseStepKey(pair ? (destinations.some((step) => step.key === pair.otherwise.toStepKey) ? pair.otherwise.toStepKey : '') : destinations[1]?.key ?? destinations[0]?.key ?? '')
    setEditingRule(true)
  }

  function saveRule(): void {
    if (!selectedField || !destinations.some((step) => step.key === yesStepKey) || !destinations.some((step) => step.key === otherwiseStepKey)) return
    const condition = simpleRuleToCondition(selectedField, ruleDraft)
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

  const parsed = selectedField ? simpleRuleToCondition(selectedField, ruleDraft) : null
  const valueRequired = ruleDraft.operator !== 'isEmpty' && ruleDraft.operator !== 'isNotEmpty'
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
            const rule = conditionToSimpleRule(pair.condition, fields)
            const summary = formatConditionRule(pair.condition, fields, language, labels)
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
        <ConditionRuleBuilder disabled={!editing || fields.length === 0} fields={fields} idPrefix={`condition-${fromStepKey}`} labels={labels} language={language} onChange={setRuleDraft} rule={ruleDraft} />
        {shouldShowDestinations ? <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {([['yes', labels.whenTrue, yesStepKey, setYesStepKey], ['otherwise', labels.otherwise, otherwiseStepKey, setOtherwiseStepKey]] as const).map(([id, label, value, setValue]) => <label className="min-w-0 text-sm font-semibold" htmlFor={`condition-${id}-${fromStepKey}`} key={id}>{label}
            <DropdownSelect className="mt-1" disabled={!editing} id={`condition-${id}-${fromStepKey}`} onChange={(event) => setValue(event.target.value)} searchable value={value}>
              <option value="">{labels.missingDestination}</option>
              {destinations.map((step) => <option key={step.key} value={step.key}>{title(step.title, language)}</option>)}
            </DropdownSelect>
          </label>)}
        </div> : null}
        {invalidDestination ? <p className="text-sm text-destructive" role="alert">{labels.invalidDestination}</p> : null}
        {selectedField && parsed ? <p aria-live="polite" className="break-words rounded-lg border border-border bg-background px-3 py-2 text-sm">{formatConditionRule(parsed, fields, language, labels)}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!editing || !parsed || invalidValue || invalidDestination} onClick={saveRule} size="sm" type="button" variant="primary">{labels.save}</Button>
          <Button onClick={() => setEditingRule(false)} size="sm" type="button" variant="secondary">{labels.cancel}</Button>
        </div>
      </div> : null}
    </section>
  )
}
