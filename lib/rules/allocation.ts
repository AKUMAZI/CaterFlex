export type CommitmentRef = { type: 'booking' | 'meal_prep'; id: number }

export function roundQuantity(value: number, decimals = 3): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export interface AllocationCommitment {
  ref: CommitmentRef
  prepStartDate: string
  fulfillmentDate: string
  ingredientQuantities: Record<number, number>
}

export interface AllocationRequirement {
  ingredientId: number
  name: string
  unit: string
  requiredPerServing: number
  currentStock: number
}

export interface AllocationShortfall {
  ingredientName: string
  required: number
  available: number
  shortBy: number
  unitOfMeasure: string
  allocated: number
}

export interface OrderAllocationShortfall extends AllocationShortfall {
  contributingItems: number[]
}

export type StockByIngredientId = Map<number, { name: string; unit: string; currentStock: number }>

export interface OrderShortfallResult {
  sufficient: boolean
  shortfalls: OrderAllocationShortfall[]
}

export function computeOrderShortfalls(
  items: { menuItemId: number; servings?: number }[],
  recipes: Map<number, { ingredientId: number; qtyPerServing: number }[]>,
  stockById: StockByIngredientId,
  window: { prepStartDate: string; fulfillmentDate: string },
  commitments: AllocationCommitment[],
  excludeRef?: CommitmentRef,
): OrderShortfallResult {
  const requiredByIngredient = new Map<number, { required: number; contributingItems: number[] }>()
  for (const item of items) {
    for (const recipe of recipes.get(item.menuItemId) ?? []) {
      const current = requiredByIngredient.get(recipe.ingredientId) ?? { required: 0, contributingItems: [] }
      current.required += (item.servings ?? 1) * recipe.qtyPerServing
      if (!current.contributingItems.includes(item.menuItemId)) current.contributingItems.push(item.menuItemId)
      requiredByIngredient.set(recipe.ingredientId, current)
    }
  }

  const shortfalls = [...requiredByIngredient].flatMap(([ingredientId, demand]) => {
    const stock = stockById.get(ingredientId)
    if (!stock) return []
    const allocated = calculateAllocatedQuantity(ingredientId, window, commitments, excludeRef)
    const available = Math.max(0, stock.currentStock - allocated)
    return available < demand.required
      ? [{ ingredientName: stock.name, required: roundQuantity(demand.required), available: roundQuantity(available), shortBy: roundQuantity(demand.required - available), unitOfMeasure: stock.unit, allocated: roundQuantity(allocated), contributingItems: demand.contributingItems }]
      : []
  })
  return { sufficient: shortfalls.length === 0, shortfalls }
}


export function servingsForBookingItem(itemQuantity: number | null | undefined, guestCount: number): number {
  const quantity = Number(itemQuantity)
  return Number.isFinite(quantity) && Number.isInteger(quantity) && quantity >= 1
    ? quantity
    : Math.max(Number.isFinite(guestCount) && Number.isInteger(guestCount) && guestCount >= 1 ? guestCount : 1, 1)
}

export function servingsForOrder(kind: 'booking' | 'meal_prep', guestCount?: number | null, mealsPerCycle?: number | null): number {
  const servings = kind === 'booking' ? Number(guestCount) : Number(mealsPerCycle)
  return Number.isFinite(servings) && servings > 0 ? servings : 1
}

export function computeBookingTotal(items: { menuItemId: number; quantity: number }[], prices: Map<number, number>): number {
  return roundQuantity(items.reduce((total, item) => total + (prices.get(item.menuItemId) ?? 0) * item.quantity, 0), 2)
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function orderPrepWindow(fulfillmentDate: string, prepDaysPerItem: number[]): { prepStartDate: string; fulfillmentDate: string } {
  const maxPrepDays = Math.max(0, ...prepDaysPerItem)
  return { prepStartDate: addDays(fulfillmentDate, -maxPrepDays), fulfillmentDate: fulfillmentDate.slice(0, 10) }
}

export function computeAllocationShortfalls(
  requirements: AllocationRequirement[],
  quantity: number,
  window: { prepStartDate: string; fulfillmentDate: string },
  commitments: AllocationCommitment[],
  excludeRef?: CommitmentRef,
): { sufficient: boolean; shortfalls: AllocationShortfall[] } {
  const shortfalls = requirements.flatMap((requirement) => {
    const allocated = calculateAllocatedQuantity(requirement.ingredientId, window, commitments, excludeRef)
    const required = requirement.requiredPerServing * quantity
    const available = Math.max(0, requirement.currentStock - allocated)
    return available < required
      ? [{ ingredientName: requirement.name, required: roundQuantity(required), available: roundQuantity(available), shortBy: roundQuantity(required - available), unitOfMeasure: requirement.unit, allocated: roundQuantity(allocated) }]
      : []
  })
  return { sufficient: shortfalls.length === 0, shortfalls }
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
export function computeOrderIngredientUsage(
  items: { menuItemId: number; servings?: number }[],
  servings: number,
  recipes: Map<number, { ingredientId: number; qtyPerServing: number }[]>,
): { ingredientId: number; quantity: number }[] {
  const usage = new Map<number, number>()
  for (const item of items) {
    for (const recipe of recipes.get(item.menuItemId) ?? []) {
      usage.set(recipe.ingredientId, (usage.get(recipe.ingredientId) ?? 0) + (item.servings ?? servings) * recipe.qtyPerServing)
    }
  }
  return [...usage].map(([ingredientId, quantity]) => ({ ingredientId, quantity }))
}

export function excludePrepared(
  commitments: AllocationCommitment[],
  preparedBookingIds: Set<number>,
  preparedMealPrepCycles: Set<string>,
): AllocationCommitment[] {
  return commitments.filter((commitment) => {
    if (commitment.ref.type === 'booking') return !preparedBookingIds.has(commitment.ref.id)
    return !preparedMealPrepCycles.has(`${commitment.ref.id}:${commitment.fulfillmentDate.slice(0, 10)}`)
  })
}

export function buildCommitment(
  ref: CommitmentRef,
  fulfillmentDate: string,
  items: { menuItemId: number; servings?: number }[],
  recipes: Map<number, { ingredientId: number; qtyPerServing: number }[]>,
  prepDays: Map<number, number>,
): AllocationCommitment {
  const window = orderPrepWindow(fulfillmentDate, items.map((item) => prepDays.get(item.menuItemId) ?? 0))
  const ingredientQuantities: Record<number, number> = {}
  for (const item of items) {
    for (const usage of computeOrderIngredientUsage([{ menuItemId: item.menuItemId, servings: item.servings }], item.servings ?? 1, recipes)) {
      ingredientQuantities[usage.ingredientId] = (ingredientQuantities[usage.ingredientId] ?? 0) + usage.quantity
    }
  }
  return { ref, prepStartDate: window.prepStartDate, fulfillmentDate: window.fulfillmentDate, ingredientQuantities }
}

/** FR-8.3; thesis sections 3.2.3 and 3.2.4: model recurring meal-prep fulfillment windows. */
export function expandRecurringDates(nextFulfillmentDate: string, pattern: 'weekly' | 'biweekly', horizonDays = 28): string[] {
  const dates: string[] = []
  const start = nextFulfillmentDate.slice(0, 10)
  const step = pattern === 'weekly' ? 7 : 14
  for (let offset = 0; offset <= horizonDays; offset += step) dates.push(addDays(start, offset))
  return dates
}

