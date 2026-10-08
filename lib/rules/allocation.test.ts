import { describe, expect, it } from 'vitest'
import { addDays, buildCommitment, calculateAllocatedQuantity, computeAllocationShortfalls, expandRecurringDates } from './allocation'

describe('allocation rules', () => {
  const recipes = new Map([[1, [{ ingredientId: 7, qtyPerServing: 2 }]], [2, [{ ingredientId: 7, qtyPerServing: 3 }]]])
  const prepDays = new Map([[1, 2], [2, 5]])
  it('expands servings into ingredient quantities', () => expect(buildCommitment({ type: 'booking', id: 1 }, '2026-10-10', [{ menuItemId: 1, servings: 2 }, { menuItemId: 2, servings: 3 }], recipes, prepDays).ingredientQuantities[7]).toBe(13))
  it('uses max prep days', () => expect(buildCommitment({ type: 'booking', id: 1 }, '2026-10-10', [{ menuItemId: 1, servings: 1 }, { menuItemId: 2, servings: 1 }], recipes, prepDays).prepStartDate).toBe('2026-10-05'))
  it('counts overlap boundaries and excludes typed refs', () => {
    const commitments = [buildCommitment({ type: 'booking', id: 5 }, '2026-10-12', [{ menuItemId: 1, servings: 4 }], recipes, prepDays), buildCommitment({ type: 'meal_prep', id: 5 }, '2026-10-12', [{ menuItemId: 1, servings: 3 }], recipes, prepDays)]
    expect(calculateAllocatedQuantity(7, { prepStartDate: '2026-10-10', fulfillmentDate: '2026-10-12' }, commitments, { type: 'booking', id: 5 })).toBe(6)
    expect(calculateAllocatedQuantity(7, { prepStartDate: '2026-10-20', fulfillmentDate: '2026-10-22' }, commitments)).toBe(0)
  })
  it('computes shortfalls from an overlapping commitment end to end', () => {
    const commitment = buildCommitment({ type: 'booking', id: 8 }, '2026-10-12', [{ menuItemId: 1, servings: 4 }], new Map([[1, [{ ingredientId: 7, qtyPerServing: 2 }]]]), new Map([[1, 0]]))
    const requirement = [{ ingredientId: 7, name: 'Ingredient X', unit: 'kg', requiredPerServing: 1, currentStock: 10 }]
    const overlapping = computeAllocationShortfalls(requirement, 5, { prepStartDate: '2026-10-10', fulfillmentDate: '2026-10-12' }, [commitment])
    expect(overlapping).toEqual({ sufficient: false, shortfalls: [{ ingredientName: 'Ingredient X', required: 5, available: 2, shortBy: 3, unitOfMeasure: 'kg', allocated: 8 }] })
    expect(computeAllocationShortfalls(requirement, 5, { prepStartDate: '2026-10-20', fulfillmentDate: '2026-10-22' }, [commitment]).sufficient).toBe(true)
  })
  it('counts exact overlap boundaries and excludes dates just outside them', () => {
    const prepBoundary = { ref: { type: 'booking' as const, id: 10 }, prepStartDate: '2026-10-12', fulfillmentDate: '2026-10-15', ingredientQuantities: { 7: 4 } }
    const prepAfter = { ...prepBoundary, ref: { type: 'booking' as const, id: 11 }, prepStartDate: '2026-10-13' }
    const fulfillmentBoundary = { ref: { type: 'booking' as const, id: 12 }, prepStartDate: '2026-10-05', fulfillmentDate: '2026-10-10', ingredientQuantities: { 7: 6 } }
    const fulfillmentBefore = { ...fulfillmentBoundary, ref: { type: 'booking' as const, id: 13 }, fulfillmentDate: '2026-10-09' }
    expect(calculateAllocatedQuantity(7, { prepStartDate: '2026-10-01', fulfillmentDate: '2026-10-12' }, [prepBoundary, prepAfter])).toBe(4)
    expect(calculateAllocatedQuantity(7, { prepStartDate: '2026-10-10', fulfillmentDate: '2026-10-20' }, [fulfillmentBoundary, fulfillmentBefore])).toBe(6)
  })
  it('handles date arithmetic across month, year, and leap-year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(expandRecurringDates('2026-01-29', 'weekly', 14)).toEqual(['2026-01-29', '2026-02-05', '2026-02-12'])
  })
  it('creates and excludes every occurrence of a recurring meal-prep order by typed ref', () => {
    const dates = expandRecurringDates('2026-10-01', 'weekly')
    const commitments = dates.map((date) => buildCommitment({ type: 'meal_prep', id: 21 }, date, [{ menuItemId: 1, servings: 1 }], new Map([[1, [{ ingredientId: 7, qtyPerServing: 2 }]]]), new Map([[1, 0]])))
    expect(commitments).toHaveLength(dates.length)
    const window = { prepStartDate: '2026-10-01', fulfillmentDate: '2026-10-29' }
    expect(calculateAllocatedQuantity(7, window, commitments, { type: 'meal_prep', id: 21 })).toBe(0)
    expect(calculateAllocatedQuantity(7, window, commitments, { type: 'booking', id: 21 })).toBe(dates.length * 2)
  })
  it('expands weekly and biweekly dates within horizon', () => { expect(expandRecurringDates('2026-10-01', 'weekly')).toEqual(['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']); expect(expandRecurringDates('2026-10-01', 'biweekly')).toEqual(['2026-10-01', '2026-10-15', '2026-10-29']) })
})
