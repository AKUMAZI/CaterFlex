import { describe, expect, it } from 'vitest'
import {
  buildCommitment,
  computeBookingTotal,
  computeOrderIngredientUsage,
  servingsForBookingItem,
} from './allocation'

describe('allocation rules', () => {
  it.each([5, 1, 65])('keeps valid integer servings %s', (value) => {
    expect(servingsForBookingItem(value, 196)).toBe(value)
  })

  it.each([null, undefined, 0, -3, 2.5, Number.NaN])('falls back to guest count for invalid servings %s', (value) => {
    expect(servingsForBookingItem(value, 196)).toBe(196)
  })

  it('uses per-dish servings consistently for usage and commitments', () => {
    const recipes = new Map([
      [1, [{ ingredientId: 10, qtyPerServing: 0.2 }]],
      [2, [{ ingredientId: 10, qtyPerServing: 0.2 }]],
      [3, [{ ingredientId: 10, qtyPerServing: 0.2 }]],
    ])
    const items = [
      { menuItemId: 1, servings: 65 },
      { menuItemId: 2, servings: 65 },
      { menuItemId: 3, servings: 66 },
    ]
    const usage = computeOrderIngredientUsage(items, 196, recipes)
    const commitment = buildCommitment({ type: 'booking', id: 1 }, '2026-10-20', items, recipes, new Map())
    expect(usage).toEqual([{ ingredientId: 10, quantity: 39.2 }])
    expect(commitment.ingredientQuantities[10]).toBe(39.2)
    expect(commitment.ingredientQuantities[10]).toBe(usage[0].quantity)
    const fallbackItems = items.map(({ menuItemId }) => ({ menuItemId, servings: null as unknown as number }))
    expect(computeOrderIngredientUsage(fallbackItems, 196, recipes)[0].quantity).toBeCloseTo(117.6)
  })

  it('rejects non-integer guest fallback values safely', () => {
    expect(servingsForBookingItem(null, 2.5)).toBe(1)
  })

  it('returns zero for an empty booking total', () => {
    expect(computeBookingTotal([], new Map())).toBe(0)
  })

  it('computes booking totals with per-dish quantities and currency rounding', () => {
    expect(computeBookingTotal(
      [{ menuItemId: 1, quantity: 3 }, { menuItemId: 2, quantity: 2 }],
      new Map([[1, 10.235], [2, 4.995]]),
    )).toBe(40.7)
  })
})
