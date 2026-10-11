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

function addDaysUtc(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function expandMealPrepOrdersForMonth(orders: CalendarMealPrepOrder[], year: number, month: number) {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)

  return orders.flatMap((order) => {
    const status = order.status.toLowerCase()
    if (order.isArchived || !['pending', 'active', 'paused'].includes(status)) return []
    const start = order.nextFulfillmentDate.slice(0, 10)
    const pattern = order.recurrencePattern.toLowerCase()
    const step = pattern === 'weekly' ? 7 : pattern === 'biweekly' ? 14 : 0
    const dates: string[] = []
    for (let date = start; date <= last; date = step ? addDaysUtc(date, step) : last + 'x') {
      if (date >= first) dates.push(date)
      if (!step) break
    }
    return dates.map((fulfillmentDate) => ({ ...order, fulfillmentDate }))
  })
}

export const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
export const addDays = addDaysUtc
