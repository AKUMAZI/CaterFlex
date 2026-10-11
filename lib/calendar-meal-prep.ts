import { addDays } from '@/lib/rules/allocation'

export type CalendarMealPrepOrder = {
  id: number
  customerName: string
  status: string
  nextFulfillmentDate: string
  recurrencePattern: string
  mealsPerCycle: number
  isArchived?: boolean
}

export type CalendarMealPrepOccurrence = CalendarMealPrepOrder & { fulfillmentDate: string }

export function expandMealPrepOrdersForMonth(
  orders: CalendarMealPrepOrder[],
  year: number,
  month: number,
): CalendarMealPrepOccurrence[] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const last = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  return orders.flatMap((order) => {
    const status = order.status.toLowerCase()
    if (order.isArchived || !['pending', 'active', 'paused'].includes(status)) return []

    const start = order.nextFulfillmentDate.slice(0, 10)
    const pattern = order.recurrencePattern.toLowerCase()
    const step = pattern === 'weekly' ? 7 : pattern === 'biweekly' ? 14 : 0
    const dates: string[] = []

    if (!step) {
      dates.push(start)
    } else {
      for (let date = start; date <= last; date = addDays(date, step)) {
        if (date >= first) dates.push(date)
      }
    }

    return dates
      .filter((date) => date >= first && date <= last)
      .map((fulfillmentDate) => ({ ...order, fulfillmentDate }))
  })
}

export function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

export { addDays }
