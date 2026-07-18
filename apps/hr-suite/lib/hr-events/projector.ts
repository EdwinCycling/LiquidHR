import type { HrChangeEvent, HrChangeEventRow, HrChangeEventType } from './types'
const types = new Set<HrChangeEventType>(['EMPLOYMENT_STARTED','EMPLOYMENT_ENDED','INCOME_RELATIONSHIP_CHANGED','ORGANIZATION_CHANGED','LABOR_CONDITIONS_CHANGED','SCHEDULE_CHANGED','SALARY_CHANGED','COST_ALLOCATION_CHANGED','DOCUMENT_ADDED','DOCUMENT_EXPIRES'])
function values(value: unknown): Record<string,string|number> { if (!value || typeof value !== 'object' || Array.isArray(value)) return {}; return Object.fromEntries(Object.entries(value).filter((entry): entry is [string,string|number] => typeof entry[1]==='string'||typeof entry[1]==='number')) }
export function projectHrEvents(rows: HrChangeEventRow[], capabilities: { canReadSalary: boolean }): HrChangeEvent[] {
  return rows.flatMap((row) => {
    if (!row.event_id||!row.event_date||!row.event_type||!types.has(row.event_type as HrChangeEventType)||!row.employee_id||!row.title_key||!row.source_href) return []
    if (row.event_type==='SALARY_CHANGED'&&!capabilities.canReadSalary) return []
    const severity: HrChangeEvent['severity'] = row.severity==='CRITICAL'?'CRITICAL':row.severity==='ATTENTION'?'ATTENTION':'INFO'
    return [{ id:row.event_id,eventDate:row.event_date,eventType:row.event_type as HrChangeEventType,employeeId:row.employee_id,employmentId:row.employment_id,titleKey:row.title_key,titleValues:values(row.title_values),sourceHref:row.source_href,severity }]
  }).sort((a,b)=>b.eventDate.localeCompare(a.eventDate)||a.id.localeCompare(b.id))
}
