import { NextResponse } from 'next/server'
import { ModuleError, moduleErrorResponse } from '@/lib/modules/module-service'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { TalentAssessmentError } from './assessment-service'
import { TalentGoalError } from './goal-service'
import { TalentReportError } from './report-service'
import { TalentNotificationError } from './notification-service'
import { TalentCheckInError } from './check-in-service'
import { TalentTeamError } from './team-service'
import { TalentServiceError } from './service'

export function talentErrorResponse(error: unknown, fallback = 'TALENT_OPERATION_FAILED') {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof TalentServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
  if (error instanceof TalentAssessmentError || error instanceof TalentGoalError || error instanceof TalentTeamError || error instanceof TalentReportError || error instanceof TalentNotificationError || error instanceof TalentCheckInError) return NextResponse.json({ error: error.code }, { status: error.status })
  if (error instanceof ModuleError) return moduleErrorResponse(error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}
