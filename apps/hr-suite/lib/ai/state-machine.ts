import type { AiExecutionStatus } from './contracts'

const transitions: Readonly<Record<AiExecutionStatus, readonly AiExecutionStatus[]>> = {
  RECEIVED: ['AUTHORIZED', 'REJECTED'],
  AUTHORIZED: ['RESERVING', 'REJECTED'],
  RESERVING: ['CONTEXT_LOADING', 'FAILED', 'REJECTED'],
  CONTEXT_LOADING: ['EXECUTING', 'RELEASING', 'FAILED'],
  EXECUTING: ['VALIDATING', 'RELEASING', 'FAILED'],
  VALIDATING: ['SETTLING', 'RELEASING', 'FAILED'],
  SETTLING: ['SUCCEEDED', 'RELEASING', 'FAILED'],
  RELEASING: ['FAILED'],
  SUCCEEDED: [],
  FAILED: [],
  REJECTED: [],
}

export function canTransition(from: AiExecutionStatus, to: AiExecutionStatus): boolean {
  return transitions[from].includes(to)
}

export function isTerminalStatus(status: AiExecutionStatus): boolean {
  return status === 'SUCCEEDED' || status === 'FAILED' || status === 'REJECTED'
}
