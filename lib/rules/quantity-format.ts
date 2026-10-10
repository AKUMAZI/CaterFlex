import { roundQuantity } from './allocation'

export function formatQuantity(value: number, unit: string): string {
  if (!Number.isFinite(value)) return `0 ${unit}`

  const normalizedUnit = unit.trim()
  const rounded = roundQuantity(value, 2)
  if ((normalizedUnit === 'g' || normalizedUnit === 'ml') && Math.abs(rounded) >= 1000) {
    const converted = roundQuantity(rounded / 1000, 2)
    return `${converted} ${normalizedUnit === 'g' ? 'kg' : 'L'}`
  }

  return `${rounded} ${normalizedUnit}`
}
