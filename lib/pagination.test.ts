import { describe, expect, it } from 'vitest'
import { paginate } from './pagination'

describe('paginate', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

  it('handles exactly 3, 4, and 7 items', () => {
    expect(paginate(items.slice(0, 3), 1, 3)).toMatchObject({ items: ['a', 'b', 'c'], page: 1, totalPages: 1 })
    expect(paginate(items.slice(0, 4), 2, 3)).toMatchObject({ items: ['d'], page: 2, totalPages: 2 })
    expect(paginate(items, 3, 3)).toMatchObject({ items: ['g'], page: 3, totalPages: 3 })
  })

  it('clamps the page', () => {
    expect(paginate(items, 0, 3).page).toBe(1)
    expect(paginate(items, 99, 3).page).toBe(3)
  })

  it('handles empty input', () => {
    expect(paginate([], 1, 3)).toEqual({ items: [], page: 1, totalPages: 1 })
  })
})
