import { safeCsvCell } from './csv'
import type { JoinersLeaversReport } from './joiners-leavers-service'

type CsvLocale = 'nl' | 'en'

const labels = {
  nl: {
    eventDate: 'Datum', eventType: 'Gebeurtenis', employeeNumber: 'Medewerkernr', employee: 'Medewerker',
    employmentNumber: 'Dienstverbandnr', administration: 'Administratie', department: 'Afdeling', team: 'Team',
    employeeFlow: 'Medewerkersstroom', placement: 'Plaatsing', terminationStatus: 'Beëindigingsstatus',
    terminationDateMatches: 'Einddatum komt overeen', reconciliation: 'Reconciliatie',
    unavailable: 'Niet beschikbaar', unassigned: 'Niet toegewezen',
    CONFIRMED: 'Bevestigd', PAYROLL_READY: 'Klaar voor salarisverwerking', REPORTED: 'Aangeleverd',
    'employment-start': 'Start dienstverband', 'employment-end': 'Einde dienstverband',
    termination: 'Bevestigde beëindiging', reconciliationEvent: 'Reconciliatie beëindiging',
    ENTERED_SCOPE: 'Medewerker stroomt in', LEFT_SCOPE: 'Medewerker stroomt uit', EMPLOYMENT_CHANGE: 'Dienstverbandmutatie', NOT_APPLICABLE: 'Niet van toepassing',
    ASSIGNED: 'Toegewezen', UNASSIGNED: 'Niet toegewezen', AMBIGUOUS: 'Onduidelijk',
    match: 'Ja', mismatch: 'Nee', notApplicable: 'Niet van toepassing',
    SOFT_DELETED_EMPLOYMENT: 'Dienstverband verwijderd', EMPLOYMENT_NOT_AVAILABLE: 'Dienstverband niet beschikbaar',
  },
  en: {
    eventDate: 'Date', eventType: 'Event', employeeNumber: 'Employee no.', employee: 'Employee',
    employmentNumber: 'Employment no.', administration: 'Administration', department: 'Department', team: 'Team',
    employeeFlow: 'Employee flow', placement: 'Placement', terminationStatus: 'Termination status',
    terminationDateMatches: 'End date matches', reconciliation: 'Reconciliation',
    unavailable: 'Unavailable', unassigned: 'Unassigned',
    CONFIRMED: 'Confirmed', PAYROLL_READY: 'Ready for payroll', REPORTED: 'Reported',
    'employment-start': 'Employment start', 'employment-end': 'Employment end',
    termination: 'Confirmed termination', reconciliationEvent: 'Termination reconciliation',
    ENTERED_SCOPE: 'Employee entered scope', LEFT_SCOPE: 'Employee left scope', EMPLOYMENT_CHANGE: 'Employment change', NOT_APPLICABLE: 'Not applicable',
    ASSIGNED: 'Assigned', UNASSIGNED: 'Unassigned', AMBIGUOUS: 'Ambiguous',
    match: 'Yes', mismatch: 'No', notApplicable: 'Not applicable',
    SOFT_DELETED_EMPLOYMENT: 'Employment is soft-deleted', EMPLOYMENT_NOT_AVAILABLE: 'Employment unavailable',
  },
} as const

export function joinersLeaversCsv(report: Pick<JoinersLeaversReport, 'rows'>, locale: CsvLocale): string {
  const text = labels[locale]
  const headers = [text.eventDate, text.eventType, text.employeeNumber, text.employee, text.employmentNumber, text.administration, text.department, text.team, text.employeeFlow, text.placement, text.terminationStatus, text.terminationDateMatches, text.reconciliation]
  const lines = [headers.map((value) => safeCsvCell(value, true)).join(';')]
  for (const row of report.rows) {
    const typeLabel = row.eventType === 'reconciliation' ? text.reconciliationEvent : text[row.eventType]
    const statusLabel = row.terminationWorkflowStatus?.split(', ').map((status) => status in text ? text[status as keyof typeof text] : status).join(', ') ?? ''
    const matchLabel = row.terminationDateMatchesEmploymentEnd === null
      ? text.notApplicable
      : row.terminationDateMatchesEmploymentEnd ? text.match : text.mismatch
    lines.push([
      row.eventDate, typeLabel, row.employeeNumber, row.employeeName, row.employmentNumber,
      row.administrationName,
      row.departmentName || (row.placementStatus === 'ASSIGNED' ? text.unavailable : text.unassigned),
      row.teamName || (row.placementStatus === 'ASSIGNED' ? text.unavailable : text.unassigned), text[row.employeeFlow],
      text[row.placementStatus], statusLabel, matchLabel,
      row.reconciliationReason ? text[row.reconciliationReason] : '',
    ].map((value) => safeCsvCell(value, true)).join(';'))
  }
  return `\uFEFFsep=;\r\n${lines.join('\r\n')}`
}
