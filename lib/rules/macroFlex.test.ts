import { describe, expect, it } from 'vitest'
import { getScrapSuggestions } from './macroFlex'


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
