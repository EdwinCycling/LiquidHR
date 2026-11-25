import { describe, expect, it } from 'vitest'
import { isSoftDeadlineOverdue, validateManagerRating, nextPhase, publicSubmissionVisible } from './performance-domain'

describe('beoordeling bij managerindiening', () => {
  it('weigert score en toelichting als de ronde geen beoordeling heeft', () => {
    expect(validateManagerRating(null, { score: 3, ratingExplanation: 'Goed' })).toBe('RATING_NOT_ALLOWED')
    expect(validateManagerRating(null, {})).toBeNull()
  })
  it('vereist een geldige score uit de momentopname en een onderbouwing', () => {
    const snapshot = [1, 2, 3, 4]
    expect(validateManagerRating(snapshot, {})).toBe('RATING_REQUIRED')
    expect(validateManagerRating(snapshot, { score: 5, ratingExplanation: 'Goed' })).toBe('RATING_INVALID')
    expect(validateManagerRating(snapshot, { score: 3, ratingExplanation: ' ' })).toBe('RATING_EXPLANATION_REQUIRED')
    expect(validateManagerRating(snapshot, { score: 3, ratingExplanation: 'Goed onderbouwd' })).toBeNull()
  })
})

describe('gespreksfasen', () => {
  it('accepteert alleen de volgende actie van de juiste rol', () => {
    expect(nextPhase('WAITING_EMPLOYEE', 'EMPLOYEE', 'SUBMIT_SELF')).toBe('WAITING_MANAGER')
    expect(nextPhase('WAITING_MANAGER', 'MANAGER', 'SUBMIT_MANAGER')).toBe('WAITING_ACKNOWLEDGEMENT')
    expect(nextPhase('WAITING_ACKNOWLEDGEMENT', 'EMPLOYEE', 'AGREE')).toBe('COMPLETED_AGREED')
    expect(nextPhase('WAITING_ACKNOWLEDGEMENT', 'EMPLOYEE', 'DISAGREE')).toBe('COMPLETED_DISAGREED')
    expect(() => nextPhase('WAITING_EMPLOYEE', 'MANAGER', 'SUBMIT_MANAGER')).toThrow('TRANSITION_FORBIDDEN')
    expect(() => nextPhase('COMPLETED_AGREED', 'EMPLOYEE', 'SUBMIT_SELF')).toThrow('TRANSITION_FORBIDDEN')
  })

  it('deelt concepten alleen met de auteur en definitieve inhoud met bevoegde dossierlezers', () => {
    expect(publicSubmissionVisible(false, 'author')).toBe(true)
    expect(publicSubmissionVisible(false, 'other-authorized')).toBe(false)
    expect(publicSubmissionVisible(true, 'other-authorized')).toBe(true)
    expect(publicSubmissionVisible(true, 'unauthorized')).toBe(false)
  })
})

describe('zachte gespreksstreefdatum', () => {
  it('markeert alleen een verstreken datum bij een actieve, onvoltooide actie', () => {
    expect(isSoftDeadlineOverdue({ dueDate: '2026-11-24', today: '2026-11-25', phase: 'WAITING_EMPLOYEE', roundStatus: 'ACTIVE' })).toBe(true)
    expect(isSoftDeadlineOverdue({ dueDate: '2026-11-25', today: '2026-11-25', phase: 'WAITING_MANAGER', roundStatus: 'ACTIVE' })).toBe(false)
    expect(isSoftDeadlineOverdue({ dueDate: '2026-11-26', today: '2026-11-25', phase: 'WAITING_MANAGER', roundStatus: 'ACTIVE' })).toBe(false)
    expect(isSoftDeadlineOverdue({ dueDate: '2026-11-24', today: '2026-11-25', phase: 'COMPLETED_AGREED', roundStatus: 'ACTIVE' })).toBe(false)
    expect(isSoftDeadlineOverdue({ dueDate: '2026-11-24', today: '2026-11-25', phase: 'WAITING_EMPLOYEE', roundStatus: 'CLOSED' })).toBe(false)
    expect(isSoftDeadlineOverdue({ today: '2026-11-25', phase: 'WAITING_EMPLOYEE', roundStatus: 'ACTIVE' })).toBe(false)
  })
})
