import { describe, expect, it } from 'vitest'
import { calculateAllocatedQuantity } from '../macroflex'
import { getScrapSuggestions } from './macroFlex'

describe('MacroFlex allocation', () => {
  it('counts only overlapping commitments and excludes the current ref', () => {
    const commitments = [
      { ref: 1, prepStartDate: '2026-10-10', fulfillmentDate: '2026-10-12', quantities: { 7: 3 } },
      { ref: 2, prepStartDate: '2026-10-20', fulfillmentDate: '2026-10-22', quantities: { 7: 9 } },
      { ref: 3, prepStartDate: '2026-10-11', fulfillmentDate: '2026-10-11', quantities: { 7: 4 } },
    ]
    expect(calculateAllocatedQuantity(7, { prepStartDate: '2026-10-11', fulfillmentDate: '2026-10-13' }, commitments, 1)).toBe(4)
  })
})

describe('MacroFlex scrap suggestions', () => {
  it('requires every ingredient of an alternative to come from scraps', () => {
    const ingredients = [
      { id: 'a', name: 'A', category: 'pantry' as const, unit: 'kg', currentStock: 2, maxCapacity: 10 },
      { id: 'b', name: 'B', category: 'pantry' as const, unit: 'kg', currentStock: 10, maxCapacity: 10 },
    ]
    const failed = { id: 'failed', name: 'Failed', requiredIngredients: [{ id: 'a', name: 'A', qty: 5, unit: 'kg' }, { id: 'b', name: 'B', qty: 5, unit: 'kg' }] } as any
    const valid = { id: 'valid', name: 'Valid', requiredIngredients: [{ id: 'a', name: 'A', qty: 2, unit: 'kg' }] } as any
    const invalid = { id: 'invalid', name: 'Invalid', requiredIngredients: [{ id: 'a', name: 'A', qty: 2, unit: 'kg' }, { id: 'b', name: 'B', qty: 1, unit: 'kg' }] } as any
    expect(getScrapSuggestions(ingredients, [failed, valid, invalid], failed)).toHaveLength(1)
    expect(getScrapSuggestions(ingredients, [failed, valid, invalid], failed)[0].dishName).toBe('Valid')
  })
})
