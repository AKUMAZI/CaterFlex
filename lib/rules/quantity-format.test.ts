import { describe, expect, it } from 'vitest'
import { formatQuantity } from './quantity-format'

describe('formatQuantity', () => {
  it.each([
    [200, 'g', '200 g'],
    [999, 'g', '999 g'],
    [1000, 'g', '1 kg'],
    [20000, 'g', '20 kg'],
    [118600, 'g', '118.6 kg'],
    [-98600, 'g', '-98.6 kg'],
    [1500, 'ml', '1.5 L'],
    [2, 'pcs', '2 pcs'],
    [0, 'g', '0 g'],
    [Number.NaN, 'g', '0 g'],
  ])('formats %s %s as %s', (value, unit, expected) => {
    expect(formatQuantity(value, unit)).toBe(expected)
  })
})
