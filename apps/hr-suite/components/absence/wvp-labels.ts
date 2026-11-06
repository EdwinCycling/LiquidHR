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

export const wvpLabelKeys = ['title','description','empty','back','work','source','start','starting','save','failed','schemaRequired','privacy','milestones','timeline','capacity','agreement','reviewOn','occurredOn','confirm','complete','close','acknowledge','responsibility','hrOwner','physicianOwner','jointOwner','noHistory','noTasks','firstAbsence','nextAction','recordAgreement','recoveryHelp','truncated','processStatus','processStatusUnknown','processDraft','processRunning','processWaiting','processBlocked','processCompleted','processRejected','processCancelled','processFailed','ACTIVE','RECOVERY_WINDOW','CLOSED','OPEN','COMPLETED','CANCELLED','OVERDUE','SOON','PLANNED','WVP_WEEK_6','WVP_WEEK_8','WVP_WEEK_42','WVP_FIRST_YEAR_REVIEW','WVP_FINAL_EVALUATION','WVP_WIA_APPLICATION','evaluation','statutory','signal','review','STARTED','MILESTONE','AGREEMENT','ACKNOWLEDGED',...agreementCodes] as const
