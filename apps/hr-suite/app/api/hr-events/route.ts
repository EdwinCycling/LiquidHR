import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { calendarQuerySchema } from '@/lib/hr-calendar/schemas'
import { listCalendarHrEvents } from '@/lib/hr-events/service'
export async function GET(request:Request){try{const url=new URL(request.url);const parsed=calendarQuerySchema.safeParse({month:url.searchParams.get('month'),q:url.searchParams.get('q')??'',department:url.searchParams.get('department')??undefined,employee:url.searchParams.get('employee')??undefined,type:url.searchParams.getAll('type')});if(!parsed.success)return NextResponse.json({code:'HR_CALENDAR_INPUT_INVALID'},{status:400});return NextResponse.json({data:await listCalendarHrEvents(parsed.data.month)})}catch(error){const response=permissionErrorResponse(error);if(response)return response;throw error}}
