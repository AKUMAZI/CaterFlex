export function validatePerServingQuantity(value: number): string | null {
  if (!Number.isInteger(value) || value < 1) {
    return 'Per-serving quantity must be a whole number greater than or equal to 1.'
  }
  return null
}

export function validateInventoryQuantity(quantity: number): string | null {
  return Number.isInteger(quantity) && quantity >= 0
    ? null
    : 'Stock and storage capacity must be whole numbers greater than or equal to 0.'
}
