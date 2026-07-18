import 'server-only'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { projectHrEvents } from './projector'
import type { HrChangeEventRow } from './types'

async function allowed(permission: string, employeeId: string): Promise<boolean> { try { await requirePermission(permission, employeeId); return true } catch (error) { if (error instanceof AuthorizationError) return false; throw error } }
async function generallyAllowed(permission: string): Promise<boolean> { try { await requirePermission(permission); return true } catch (error) { if (error instanceof AuthorizationError) return false; throw error } }
export async function listEmployeeHrEvents(employeeId: string, options: { employmentId?: string; from?: string; to?: string } = {}) {
  await requirePermission('contract:read', employeeId); const canReadSalary = await allowed('salary:read', employeeId); const supabase = await createClient()
  let query = supabase.from('hr_change_events').select('event_id,event_date,event_type,employee_id,employment_id,title_key,title_values,source_href,severity').eq('employee_id', employeeId)
  if (options.employmentId) query = query.eq('employment_id', options.employmentId)
  if (options.from) query = query.gte('event_date', options.from)
  if (options.to) query = query.lte('event_date', options.to)
  const { data, error } = await query.order('event_date', { ascending: false }).limit(2000)
  if (error) throw new Error('HR_EVENTS_READ_FAILED')
  return projectHrEvents((data ?? []) as HrChangeEventRow[], { canReadSalary })
}

export async function listCalendarHrEvents(month: string) {
  const context = await requirePermission('hr-calendar:read'); if (!context.administrationId) throw new Error('ADMINISTRATION_REQUIRED')
  const canReadSalary = await generallyAllowed('salary:read'); const supabase = await createClient(); const from=`${month}-01`; const untilDate=new Date(`${from}T00:00:00Z`); untilDate.setUTCMonth(untilDate.getUTCMonth()+1); const to=untilDate.toISOString().slice(0,10)
  const result=await supabase.from('hr_change_events').select('event_id,event_date,event_type,employee_id,employment_id,title_key,title_values,source_href,severity').eq('administration_id',context.administrationId).gte('event_date',from).lt('event_date',to).order('event_date').limit(5000)
  if(result.error) throw new Error('HR_EVENTS_READ_FAILED'); const events=projectHrEvents((result.data??[]) as HrChangeEventRow[],{canReadSalary}); const employeeIds=[...new Set(events.map((event)=>event.employeeId))]
  if(employeeIds.length===0)return {events,employees:[],departments:[]}
  const today=new Date().toISOString().slice(0,10); const [employees,organizations,departments]=await Promise.all([
    supabase.from('employees').select('id, employee_number, first_name, birth_name').in('id',employeeIds).order('birth_name').limit(2000),
    supabase.from('employee_organizations').select('employee_id,department_id').in('employee_id',employeeIds).lte('effective_from',today).or(`effective_to.is.null,effective_to.gte.${today}`).limit(3000),
    supabase.from('departments').select('id,code,name').eq('administration_id',context.administrationId).eq('is_active',true).order('code').limit(500),
  ])
  if(employees.error||organizations.error||departments.error)throw new Error('HR_CALENDAR_CONTEXT_FAILED')
  const departmentByEmployee=new Map((organizations.data??[]).map((item)=>[item.employee_id,item.department_id]))
  return {events,employees:(employees.data??[]).map((employee)=>({...employee,departmentId:departmentByEmployee.get(employee.id)??null})),departments:departments.data??[]}
}
