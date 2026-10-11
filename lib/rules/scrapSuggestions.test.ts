import { describe, expect, it } from 'vitest'
import { getScrapSuggestions, getScrapSuggestionsForBlockedDishes } from './scrapSuggestions'

const ingredients = [
  { id: 'rice', name: 'Rice', currentStock: 10, unit: 'kg' },
  { id: 'beans', name: 'Beans', currentStock: 4, unit: 'kg' },
  { id: 'spice', name: 'Spice', currentStock: 1, unit: 'kg' },
]

const dishes = [
  { id: 'blocked', name: 'Blocked', availability: true, requiredIngredients: [{ id: 'empty', name: 'Empty', qty: 1, unit: 'kg' }] },
  { id: 'rice-dish', name: 'Rice Dish', availability: true, requiredIngredients: [{ id: 'rice', name: 'Rice', qty: 2, unit: 'kg' }] },
  { id: 'outside', name: 'Outside', availability: true, requiredIngredients: [{ id: 'beans', name: 'Beans', qty: 2, unit: 'kg' }] },
  { id: 'unavailable', name: 'Unavailable', availability: false, requiredIngredients: [{ id: 'rice', name: 'Rice', qty: 1, unit: 'kg' }] },
  { id: 'too-much', name: 'Too Much', availability: true, requiredIngredients: [{ id: 'beans', name: 'Beans', qty: 5, unit: 'kg' }] },
  { id: 'empty', name: 'Empty Recipe', availability: true, requiredIngredients: [] },
]

describe('blocked dish suggestion selection', () => {
  it('returns no suggestions when no dish is blocked', () => {
    expect(getScrapSuggestionsForBlockedDishes([dishes[1], dishes[2]], ingredients)).toEqual([])
  })

  it('excludes the blocked dish from its own suggestions', () => {
    expect(getScrapSuggestions('rice-dish', [dishes[1], dishes[2]], ingredients).map((suggestion) => suggestion.dishId)).toEqual(['outside'])
  })

  it('deduplicates an alternate shared by two blocked dishes', () => {
    const blockedA = { ...dishes[4], id: 'blocked-a' }
    const blockedB = { ...dishes[4], id: 'blocked-b' }
    expect(getScrapSuggestionsForBlockedDishes([blockedA, blockedB, dishes[1]], ingredients).map((suggestion) => suggestion.dishId)).toEqual(['rice-dish'])
  })
})

describe('getScrapSuggestions', () => {
  it('suggests stocked alternate dishes, including ingredients outside the blocked recipe', () => {
    const suggestions = getScrapSuggestions('blocked', dishes, ingredients)
    expect(suggestions.map((suggestion) => suggestion.dishId)).toEqual(['rice-dish', 'outside'])
    expect(suggestions[0].usesLeftover).toEqual([{ ingredientId: 'rice', ingredientName: 'Rice', quantity: 2, unit: 'kg' }])
  })

  it('excludes reserved stock and invalid dishes', () => {
    const suggestions = getScrapSuggestions('blocked', dishes, ingredients, { rice: 9, beans: 3 })
    expect(suggestions.map((suggestion) => suggestion.dishId)).toEqual([])
  })
})
// Fully stocked ingredients count because the comparison is inclusive.
describe('stock boundaries', () => {
  it('allows a recipe using exactly the available quantity', () => {
    expect(getScrapSuggestions('blocked', [dishes[0], dishes[2]], ingredients, { beans: 2 })).toHaveLength(1)
  })
})
