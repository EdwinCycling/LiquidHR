import type { ProcessDefinitionDraft } from '@/lib/process-automation/definition-schemas'

const text = (nl: string, en: string) => ({ nl, en })

const milestones = [
  { code: 'WVP_WEEK_6', day: 42, title: text('Probleemanalyse ontvangen', 'Receive problem analysis') },
  { code: 'WVP_WEEK_8', day: 56, title: text('Plan van aanpak', 'Action plan') },
  { code: 'WVP_WEEK_42', day: 294, title: text('42e-weeksmelding voorbereiden', 'Prepare 42-week notification') },
  { code: 'WVP_FIRST_YEAR_REVIEW', day: 364, title: text('Eerstejaarsevaluatie', 'First-year evaluation') },
  { code: 'WVP_FINAL_EVALUATION', day: 637, title: text('Eindevaluatie', 'Final evaluation') },
  { code: 'WVP_WIA_APPLICATION', day: 651, title: text('WIA-aanvraag opvolgen', 'Follow up WIA application') },
  ...Array.from({ length: 16 }, (_, index) => ({ code: `WVP_EVALUATION_6W_${String(index + 1).padStart(2, '0')}`, day: 56 + (index + 1) * 42, title: text(`Voortgangsevaluatie ${index + 1}`, `Progress evaluation ${index + 1}`) })),
].sort((a, b) => a.day - b.day || a.code.localeCompare(b.code))
const stepKey = (code: string) => code.toLowerCase().replaceAll('_', '-')

// Iedere mijlpaal activeert een nieuw PMUX-werkitem met een immutable deadline.
// Herstel kan vanuit iedere stap afsluiten; een DB-guard eist de domeinafronding.
export const wvpProcessDefinition: ProcessDefinitionDraft = {
  schemaVersion: 1, key: 'wvp01-guidance', status: 'DRAFT',
  title: text('Verzuimbegeleiding en werkhervatting', 'Absence guidance and return to work'),
  description: text('Volg het verzuimdossier en de eerstvolgende mijlpaal op. Leg geen medische gegevens vast.', 'Follow the absence dossier and next milestone. Do not record medical information.'),
  enabledLanguages: ['nl', 'en'], startStepKey: 'wvp-week-6',
  participants: [{ key: 'case-owner', label: text('HR-werkvoorraad', 'HR work queue'), selector: { type: 'PERMISSION_WORK_QUEUE', permission: 'process-definition:publish', queueKey: 'wvp01', resolutionDatePolicy: 'STEP_ACTIVATED_AT' }, assignmentMode: 'ANY_ONE', permission: 'process-definition:publish' }],
  forms: [{ key: 'guidance-form', version: 1, title: text('Traject afronden', 'Close guidance'), sections: [{ key: 'confirmation', title: text('Afronding', 'Completion'), fields: [{ key: 'confirmed', label: text('Het traject is gereed voor afsluiting', 'The guidance is ready to close'), type: 'BOOLEAN', binding: { kind: 'PROCESS_ONLY' }, access: [{ participantKey: 'case-owner', mode: 'WRITE_OPTIONAL' }] }] }] }],
  steps: [
    ...milestones.map(m => ({ key: stepKey(m.code), type: 'FORM' as const, title: m.title, participantKey: 'case-owner', formKey: 'guidance-form', allowedActions: ['SUBMIT' as const, 'CANCEL' as const], sla: { duration: { amount: 42, unit: 'DAYS' as const }, businessDays: false, onBreach: 'ESCALATE' as const, escalationParticipantKey: 'case-owner', notifications: { beforeDeadline: 'TWENTY_FOUR_HOURS' as const, atDeadline: true } } })),
    { key: 'guidance', type: 'FORM', title: text('Traject afronden', 'Close guidance'), participantKey: 'case-owner', formKey: 'guidance-form', allowedActions: ['CANCEL'] },
    { key: 'completed', type: 'END', title: text('Traject afgerond', 'Guidance completed'), allowedActions: [], terminalOutcome: 'COMPLETED' },
  ],
  transitions: [
    ...milestones.map((m, index) => ({ key: `${stepKey(m.code)}-next`, fromStepKey: stepKey(m.code), toStepKey: milestones[index + 1] ? stepKey(milestones[index + 1].code) : 'guidance', action: 'SUBMIT' as const, kind: 'FORWARD' as const, label: text('Mijlpaal bevestigen', 'Confirm milestone') })),
    ...[...milestones.map(m => stepKey(m.code)), 'guidance'].map(key => ({ key: `${key}-close`, fromStepKey: key, toStepKey: 'completed', action: 'CANCEL' as const, kind: 'FORWARD' as const, label: text('Traject afronden na herstel', 'Close guidance after recovery') })),
  ],
}
