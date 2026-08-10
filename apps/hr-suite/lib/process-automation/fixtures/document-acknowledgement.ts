import type { ProcessDefinitionDraft } from '../definition-schemas'

const text = (nl: string, en: string) => ({ nl, en })

const access = (participantKey: string, mode: 'READ' | 'WRITE_REQUIRED') => ({ participantKey, mode })

export const documentAcknowledgementFixture: ProcessDefinitionDraft = {
  schemaVersion: 1,
  key: 'document-acknowledgement',
  status: 'DRAFT',
  title: text('Document lezen en bevestigen', 'Read and acknowledge document'),
  description: text(
    'Laat een medewerker een toegewezen document lezen en expliciet bevestigen.',
    'Ask an employee to read an assigned document and explicitly acknowledge it.',
  ),
  enabledLanguages: ['nl', 'en'],
  startStepKey: 'acknowledge',
  participants: [
    {
      key: 'subject-employee',
      label: text('Medewerker', 'Employee'),
      selector: { type: 'SUBJECT_EMPLOYEE', resolutionDatePolicy: 'STEP_ACTIVATED_AT' },
      assignmentMode: 'EXACTLY_ONE',
      permission: 'self:process-task:act',
    },
  ],
  forms: [
    {
      key: 'document-acknowledgement-form',
      version: 1,
      title: text('Documentbevestiging', 'Document acknowledgement'),
      description: text('Lees het document en bevestig daarna dat je kennis hebt genomen.', 'Read the document and then confirm that you have acknowledged it.'),
      sections: [
        {
          key: 'document',
          title: text('Document', 'Document'),
          fields: [
            {
              key: 'document',
              label: text('Toegevoegd document', 'Assigned document'),
              type: 'DOCUMENT_REFERENCE',
              binding: { kind: 'DOMAIN_READ', key: 'employee.document' },
              access: [access('subject-employee', 'READ')],
            },
            {
              key: 'acknowledged',
              label: text('Ik heb dit document gelezen en begrepen.', 'I have read and understood this document.'),
              type: 'BOOLEAN',
              binding: { kind: 'PROCESS_ONLY' },
              access: [access('subject-employee', 'WRITE_REQUIRED')],
            },
          ],
        },
      ],
    },
  ],
  steps: [
    {
      key: 'acknowledge',
      type: 'ACKNOWLEDGEMENT',
      title: text('Document bevestigen', 'Acknowledge document'),
      participantKey: 'subject-employee',
      formKey: 'document-acknowledgement-form',
      allowedActions: ['ACKNOWLEDGE', 'CANCEL'],
    },
    {
      key: 'completed',
      type: 'END',
      title: text('Afgerond', 'Completed'),
      allowedActions: [],
      terminalOutcome: 'COMPLETED',
    },
    {
      key: 'cancelled',
      type: 'END',
      title: text('Geannuleerd', 'Cancelled'),
      allowedActions: [],
      terminalOutcome: 'CANCELLED',
    },
  ],
  transitions: [
    {
      key: 'acknowledge-complete',
      fromStepKey: 'acknowledge',
      toStepKey: 'completed',
      action: 'ACKNOWLEDGE',
      kind: 'FORWARD',
      label: text('Bevestig kennisname', 'Acknowledge document'),
    },
    {
      key: 'acknowledge-cancel',
      fromStepKey: 'acknowledge',
      toStepKey: 'cancelled',
      action: 'CANCEL',
      kind: 'FORWARD',
      label: text('Annuleer', 'Cancel'),
    },
  ],
  output: {
    key: 'document-acknowledgement-record',
    title: text('Bevestiging documentkennisname', 'Document acknowledgement record'),
    format: 'PDF',
    dossierCategoryKey: 'process-document-acknowledgement',
    fieldKeys: ['document', 'acknowledged'],
  },
}
