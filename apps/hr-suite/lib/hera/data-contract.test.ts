import { describe, expect, it } from 'vitest'
import { buildHeRaSystemInstruction } from './data-contract'

describe('buildHeRaSystemInstruction', () => {
  it('verplicht intern toolbewijs en verbiedt bestaanlekken', () => {
    const instruction = buildHeRaSystemInstruction({
      locale: 'nl',
      personaInstruction: 'Schrijf precies en datagericht.',
      tone: 'BUSINESS',
      detailLevel: 'COMPACT',
      seniorityLevel: 'EXPERT',
      currentDate: '2026-07-17',
      timeZone: 'Europe/Amsterdam',
      memory: ['Antwoord compact.'],
    })

    expect(instruction).toContain('Beantwoord interne HR-feitvragen uitsluitend na een geslaagde toolcall')
    expect(instruction).toContain('Bevestig of ontken geen afgeschermde records')
    expect(instruction).toContain('Gebruik nooit internet tenzij de gebruiker dat expliciet vraagt')
    expect(instruction).toContain('17 juli 2026')
    expect(instruction).toContain('Europe/Amsterdam')
    expect(instruction).toContain('Antwoord compact.')
  })

  it('scheidt gebruikersgeheugen van organisatiefeiten', () => {
    const instruction = buildHeRaSystemInstruction({
      locale: 'nl',
      personaInstruction: 'Schrijf toegankelijk.',
      tone: 'FRIENDLY',
      detailLevel: 'BALANCED',
      seniorityLevel: 'BASIC',
      currentDate: '2026-07-17',
      timeZone: 'Europe/Amsterdam',
      memory: ['Ik wil korte antwoorden.'],
    })

    expect(instruction).toContain('Geheugen is alleen een voorkeur van deze gebruiker')
    expect(instruction).toContain('nooit bewijs over medewerkers of de organisatie')
  })
})
