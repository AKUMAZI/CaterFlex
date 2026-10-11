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

export type CalendarBooking = {
  BookingID: number
  CustomerID: number
  EventDate: string
  EventTime: string
  Venue: string
  GuestCount: number
  Status: string
  IsArchived?: boolean | null
  customerName: string
}

export type CalendarItem =
  | { kind: 'catering'; id: number; date: string; name: string; status: string; booking: CalendarBooking }
  | { kind: 'meal'; id: number; date: string; name: string; status: string; mealPrep: CalendarMealPrepOccurrence }

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

export function filterCalendarBookings(bookings: CalendarBooking[]) {
  return bookings.filter((booking) => !booking.IsArchived && ['pending', 'confirmed'].includes(booking.Status.toLowerCase()))
}

export function groupCalendarItemsByDate(bookings: CalendarBooking[], mealPrepOrders: CalendarMealPrepOccurrence[]) {
  const items: CalendarItem[] = [
    ...filterCalendarBookings(bookings).map((booking) => ({ kind: 'catering' as const, id: booking.BookingID, date: booking.EventDate.slice(0, 10), name: booking.customerName, status: booking.Status, booking })),
    ...mealPrepOrders.map((mealPrep) => ({ kind: 'meal' as const, id: mealPrep.id, date: mealPrep.fulfillmentDate, name: mealPrep.customerName, status: mealPrep.status, mealPrep })),
  ]
  return items.reduce<Record<string, CalendarItem[]>>((groups, item) => {
    ;(groups[item.date] ??= []).push(item)
    return groups
  }, {})
}

export const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
export const addDays = addDaysUtc

export const calendarChipClass = (item: CalendarItem) => item.kind === 'meal'
  ? `border border-teal-600/50 bg-teal-100 text-teal-800 ${item.status.toLowerCase() === 'pending' ? 'border-dashed' : item.status.toLowerCase() === 'paused' ? 'opacity-60' : ''}`
  : 'bg-primary/20 text-primary'

export const calendarStatusClass = (status: string) => ['active', 'confirmed'].includes(status.toLowerCase()) ? 'bg-green-100 text-green-800' : status.toLowerCase() === 'paused' ? 'bg-muted text-muted-foreground' : 'bg-yellow-100 text-yellow-800'

export const chipItems = (items: CalendarItem[]) => items.slice(0, 3)
export const detailItems = (items: CalendarItem[]) => items
