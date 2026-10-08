export type CommitmentRef = { type: 'booking' | 'meal_prep'; id: number }

export interface AllocationCommitment {
  ref: CommitmentRef
  prepStartDate: string
  fulfillmentDate: string
  ingredientQuantities: Record<number, number>
}

/** FR-8.3; thesis sections 3.2.3 and 3.2.4: count only overlapping stock commitments. */
export function calculateAllocatedQuantity(
  ingredientId: number,
  window: { prepStartDate: string; fulfillmentDate: string },
  commitments: AllocationCommitment[],
  excludeRef?: CommitmentRef,
): number {
  return commitments
    .filter((commitment) => !excludeRef || commitment.ref.type !== excludeRef.type || commitment.ref.id !== excludeRef.id)
    .filter((commitment) => commitment.prepStartDate <= window.fulfillmentDate && commitment.fulfillmentDate >= window.prepStartDate)
    .reduce((total, commitment) => total + (commitment.ingredientQuantities[ingredientId] ?? 0), 0)
}

/** FR-8.3; thesis sections 3.2.3 and 3.2.4: expand menu servings into ingredient demand. */
export function buildCommitment(
  ref: CommitmentRef,
  fulfillmentDate: string,
  items: { menuItemId: number; servings: number }[],
  recipes: Map<number, { ingredientId: number; qtyPerServing: number }[]>,
  prepDays: Map<number, number>,
): AllocationCommitment {
  const maxPrepDays = Math.max(0, ...items.map((item) => prepDays.get(item.menuItemId) ?? 0))
  const start = new Date(`${fulfillmentDate.slice(0, 10)}T00:00:00`)
  start.setDate(start.getDate() - maxPrepDays)
  const ingredientQuantities: Record<number, number> = {}
  for (const item of items) {
    for (const recipe of recipes.get(item.menuItemId) ?? []) {
      ingredientQuantities[recipe.ingredientId] = (ingredientQuantities[recipe.ingredientId] ?? 0) + item.servings * recipe.qtyPerServing
    }
  }
  return { ref, prepStartDate: start.toISOString().slice(0, 10), fulfillmentDate: fulfillmentDate.slice(0, 10), ingredientQuantities }
}

/** FR-8.3; thesis sections 3.2.3 and 3.2.4: model recurring meal-prep fulfillment windows. */
export function expandRecurringDates(nextFulfillmentDate: string, pattern: 'weekly' | 'biweekly', horizonDays = 28): string[] {
  const dates: string[] = []
  const start = new Date(`${nextFulfillmentDate.slice(0, 10)}T12:00:00`)
  const step = pattern === 'weekly' ? 7 : 14
  for (let date = new Date(start); date.getTime() <= start.getTime() + horizonDays * 86400000; date.setDate(date.getDate() + step)) {
    dates.push(date.toISOString().slice(0, 10))
  }
  return dates
}

