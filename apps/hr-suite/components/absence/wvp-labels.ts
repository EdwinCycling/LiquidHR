import { agreementCodes } from '@/lib/absence/wvp/domain'

export type WvpLabels = Record<string, string>

export function milestoneLabel(code: string, labels: WvpLabels): string {
  return code.startsWith('WVP_EVALUATION_6W_') ? `${labels.evaluation} ${Number(code.slice(-2))}` : labels[code] ?? labels.milestones
}

export function processStatusLabel(status: string, labels: WvpLabels): string {
  const key: Record<string, string> = {
    DRAFT: 'processDraft', RUNNING: 'processRunning', WAITING: 'processWaiting', BLOCKED: 'processBlocked',
    COMPLETED: 'processCompleted', REJECTED: 'processRejected', CANCELLED: 'processCancelled', FAILED: 'processFailed',
  }
  return labels[key[status] ?? 'processStatusUnknown']
}

export const wvpLabelKeys = ['progressTitle','progressSourceMissing','progressEventMissing','progressLegalNote','progressTaskStatus','title','description','empty','back','work','source','start','starting','save','failed','schemaRequired','WVP_FORBIDDEN','WVP_CLOSED','WVP_RECOVERY_WINDOW_OPEN','WVP_DUE_TASKS_OPEN','WVP_TASK_SEQUENCE','WVP_TASK_NOT_PENDING','WVP_INVALID_DATE','WVP_INVALID_INPUT','WVP_IDEMPOTENCY_CONFLICT','WVP_CASE_LINK_REQUIRED','WVP_CASE_NOT_ACTIVE','WVP_CONFIRMATION_REQUIRED','WVP_DEFINITION_REQUIRED','WVP_DOMAIN_ACTION_REQUIRED','WVP_FREE_TEXT_FORBIDDEN','WVP_HISTORY_IMMUTABLE','WVP_MILESTONE_NOT_FOUND','WVP_NOT_STARTED','WVP_WORK_ITEM_UNAVAILABLE','WVP_DOCUMENT_INVALID','WVP_LINK_FAILED','WVP_LINK_NOT_FOUND','WVP_LINK_IMMUTABLE','WVP_MILESTONE_INVALID','privacy','milestones','dossierReadinessNote','dossierOwner','dossierEvent','dossierReadinessRecorded','dossierReadinessOpen','dossierReadinessMissingEvent','dossierReadinessCancelled','dossierReadinessUnknown','dossierOwnerPhysician','dossierOwnerJoint','dossierOwnerHr','dossierOwnerEmployee','dossierOwnerUnknown','employeeDocuments','timeline','capacity','documents','documentLinkHelp','documentLinksUnavailable','documentsUnavailable','documentUnavailable','noDocumentLink','noAvailableDocuments','selectDocument','linkDocument','removeDocumentLink','removeDocumentLinkTitle','removeDocumentLinkDescription','cancel','agreement','reviewOn','occurredOn','confirm','complete','close','acknowledge','responsibility','hrOwner','physicianOwner','jointOwner','noHistory','noTasks','firstAbsence','nextAction','recordAgreement','recoveryHelp','truncated','week42Preparation','week42Deadline','week42ReviewNote','processStatus','processStatusUnknown','processDraft','processRunning','processWaiting','processBlocked','processCompleted','processRejected','processCancelled','processFailed','ACTIVE','RECOVERY_WINDOW','CLOSED','OPEN','COMPLETED','CANCELLED','OVERDUE','SOON','PLANNED','WVP_WEEK_6','WVP_WEEK_8','WVP_WEEK_42','WVP_FIRST_YEAR_REVIEW','WVP_FINAL_EVALUATION','WVP_WIA_APPLICATION','evaluation','statutory','signal','review','STARTED','MILESTONE','AGREEMENT','ACKNOWLEDGED',...agreementCodes] as const
