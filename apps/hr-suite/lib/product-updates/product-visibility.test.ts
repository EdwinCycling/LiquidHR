import { describe, expect, it } from 'vitest'
import { isProductAudienceUpdate } from './product-visibility'
describe('product update audience', () => {
  it.each(['[TEST] Bericht', '[TEST OWNER] Bericht', '[DEMO] Bericht', '[FIXTURE] Bericht', '[BENCHMARK] Bericht'])('withholds explicitly internal message %s', title => {
    expect(isProductAudienceUpdate(title)).toBe(false)
  })
  it.each(['Nieuwe salarisoverzichten', 'Testen van kennisvragen', 'Verbeterde fiscale registratie'])('retains genuine product communication %s', title => {
    expect(isProductAudienceUpdate(title)).toBe(true)
  })
})
