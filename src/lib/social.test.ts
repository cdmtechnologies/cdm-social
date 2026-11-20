import { describe, expect, it } from 'vitest'
import { fromLocalInput, lengthFor, toLocalInput, xLength } from './social'

describe('CDM Social helpers', () => {
  it('counts lengths like each network', () => {
    expect(xLength('see https://cdmtechnologies.github.io/cdm-social/a/very/long/path')).toBe(4 + 23)
    expect(lengthFor('facebook', 'héllo 👋')).toBe(7)
  })
  it('round-trips the schedule input', () => {
    const iso = '2026-11-21T08:30:00.000Z'
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso)
    expect(fromLocalInput('')).toBe(null)
  })
})
