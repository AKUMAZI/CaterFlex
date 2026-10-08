import { describe, expect, it } from 'vitest'
import { buildCommitment, calculateAllocatedQuantity, expandRecurringDates } from './allocation'

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
  it('expands weekly and biweekly dates within horizon', () => { expect(expandRecurringDates('2026-10-01', 'weekly')).toEqual(['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']); expect(expandRecurringDates('2026-10-01', 'biweekly')).toEqual(['2026-10-01', '2026-10-15', '2026-10-29']) })
})
