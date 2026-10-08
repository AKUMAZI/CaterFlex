import { describe, expect, it } from 'vitest'
import { addDays, buildCommitment, calculateAllocatedQuantity, computeAllocationShortfalls, computeOrderShortfalls, expandRecurringDates, orderPrepWindow, servingsForOrder } from './allocation'

describe('allocation rules', () => {
  const recipes = new Map([[1, [{ ingredientId: 7, qtyPerServing: 2 }]], [2, [{ ingredientId: 7, qtyPerServing: 3 }]]])
  const prepDays = new Map([[1, 2], [2, 5]])
  it('derives servings from the order and defaults invalid values to one', () => {
    expect(servingsForOrder('booking', 100)).toBe(100)
    expect(servingsForOrder('meal_prep', undefined, 8)).toBe(8)
    for (const value of [undefined, null, 0, -1]) {
      expect(servingsForOrder('booking', value)).toBe(1)
      expect(servingsForOrder('meal_prep', undefined, value)).toBe(1)
    }
  })
  it('expands order-level servings into ingredient quantities', () => {
    const booking = buildCommitment({ type: 'booking', id: 2 }, '2026-10-10', [{ menuItemId: 1, servings: servingsForOrder('booking', 4) }], new Map([[1, [{ ingredientId: 7, qtyPerServing: 2 }]]]), new Map([[1, 0]]))
    expect(booking.ingredientQuantities[7]).toBe(8)
    const requirement = [{ ingredientId: 7, name: 'Rice', unit: 'kg', requiredPerServing: 1, currentStock: 10 }]
    expect(computeAllocationShortfalls(requirement, 5, { prepStartDate: '2026-10-10', fulfillmentDate: '2026-10-10' }, [booking])).toMatchObject({ sufficient: false, shortfalls: [{ available: 2, allocated: 8 }] })
  })
  it('expands meal-prep order servings for every recurring occurrence', () => {
    const dates = expandRecurringDates('2026-10-01', 'weekly')
    const commitments = dates.map((date) => buildCommitment({ type: 'meal_prep', id: 3 }, date, [{ menuItemId: 1, servings: servingsForOrder('meal_prep', undefined, 3) }], new Map([[1, [{ ingredientId: 7, qtyPerServing: 2 }]]]), new Map([[1, 0]])))
    expect(commitments).toHaveLength(dates.length)
    expect(commitments.every((commitment) => commitment.ingredientQuantities[7] === 6)).toBe(true)
  })
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
  it('builds an order prep window from the maximum prep time', () => {
    expect(orderPrepWindow('2026-10-10', [1, 5, 2])).toEqual({ prepStartDate: '2026-10-05', fulfillmentDate: '2026-10-10' })
    expect(orderPrepWindow('2026-10-10', [])).toEqual({ prepStartDate: '2026-10-10', fulfillmentDate: '2026-10-10' })
    expect(orderPrepWindow('2026-03-01', [2])).toEqual({ prepStartDate: '2026-02-27', fulfillmentDate: '2026-03-01' })
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
  it('combines shared ingredient demand across dishes', () => {
    const sharedRecipes = new Map([[1, [{ ingredientId: 7, qtyPerServing: 6 }]], [2, [{ ingredientId: 7, qtyPerServing: 6 }]]])
    const stock = new Map([[7, { name: 'Rice', unit: 'kg', currentStock: 10 }]])
    const window = { prepStartDate: '2026-10-10', fulfillmentDate: '2026-10-10' }
    expect(computeAllocationShortfalls([{ ingredientId: 7, name: 'Rice', unit: 'kg', requiredPerServing: 6, currentStock: 10 }], 1, window, []).sufficient).toBe(true)
    expect(computeOrderShortfalls([{ menuItemId: 1, servings: 1 }, { menuItemId: 2, servings: 1 }], sharedRecipes, stock, window, [])).toEqual({ sufficient: false, shortfalls: [{ ingredientName: 'Rice', required: 12, available: 10, shortBy: 2, unitOfMeasure: 'kg', allocated: 0, contributingItems: [1, 2] }] })
  })
  it('keeps separate ingredients independent and reports each shortfall once', () => {
    const recipesWithoutOverlap = new Map([[1, [{ ingredientId: 7, qtyPerServing: 6 }]], [2, [{ ingredientId: 8, qtyPerServing: 6 }]]])
    const stock = new Map([[7, { name: 'Rice', unit: 'kg', currentStock: 10 }], [8, { name: 'Beans', unit: 'kg', currentStock: 10 }]])
    const result = computeOrderShortfalls([{ menuItemId: 1, servings: 1 }, { menuItemId: 2, servings: 1 }], recipesWithoutOverlap, stock, { prepStartDate: '2026-10-10', fulfillmentDate: '2026-10-10' }, [])
    expect(result.sufficient).toBe(true)
    expect(result.shortfalls).toHaveLength(0)
  })
  it('subtracts overlapping other bookings from combined demand', () => {
    const stock = new Map([[7, { name: 'Rice', unit: 'kg', currentStock: 5 }]])
    const other = buildCommitment({ type: 'booking', id: 9 }, '2026-10-10', [{ menuItemId: 1, servings: 1 }], recipes, new Map([[1, 0], [2, 0]]))
    const result = computeOrderShortfalls([{ menuItemId: 1, servings: 1 }, { menuItemId: 2, servings: 1 }], recipes, stock, { prepStartDate: '2026-10-10', fulfillmentDate: '2026-10-10' }, [other])
    expect(result.shortfalls[0]).toMatchObject({ required: 5, available: 3, allocated: 2, shortBy: 2, contributingItems: [1, 2] })
    expect(result.sufficient).toBe(false)
  })
  it('excludes the order itself but not sibling demand', () => {
    const stock = new Map([[7, { name: 'Rice', unit: 'kg', currentStock: 4 }]])
    const sibling = buildCommitment({ type: 'booking', id: 12 }, '2026-10-10', [{ menuItemId: 1, servings: 1 }], recipes, new Map([[1, 0], [2, 0]]))
    const result = computeOrderShortfalls([{ menuItemId: 1, servings: 1 }, { menuItemId: 2, servings: 1 }], recipes, stock, { prepStartDate: '2026-10-10', fulfillmentDate: '2026-10-10' }, [sibling], { type: 'booking', id: 12 })
    expect(result.shortfalls[0]).toMatchObject({ required: 5, allocated: 0, available: 4, shortBy: 1, contributingItems: [1, 2] })
  })
  it('ignores non-overlapping commitments', () => {
    const stock = new Map([[7, { name: 'Rice', unit: 'kg', currentStock: 10 }]])
    const outside = buildCommitment({ type: 'booking', id: 13 }, '2026-11-10', [{ menuItemId: 1, servings: 10 }], recipes, new Map([[1, 0], [2, 0]]))
    expect(computeOrderShortfalls([{ menuItemId: 1, servings: 1 }], recipes, stock, { prepStartDate: '2026-10-10', fulfillmentDate: '2026-10-10' }, [outside]).sufficient).toBe(true)
  })
})
