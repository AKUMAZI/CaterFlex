import { addDays, expandRecurringDates } from '@/lib/rules/allocation'

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
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const last = `${year}-${String(month).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`

  return orders.flatMap((order) => {
    const status = order.status.toLowerCase()
    if (order.isArchived || ['cancelled', 'rejected'].includes(status)) return []
    const pattern = order.recurrencePattern.toLowerCase()
    const dates = pattern === 'weekly' || pattern === 'biweekly'
      ? expandRecurringDates(order.nextFulfillmentDate, pattern, 28)
      : [order.nextFulfillmentDate.slice(0, 10)]
    return dates
      .filter((date) => date >= first && date <= last)
      .map((fulfillmentDate) => ({ ...order, fulfillmentDate }))
  })
}

export function monthDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export { addDays }

export function isCalendarMealPrepStatus(status: string) {
  return ['pending', 'active', 'paused'].includes(status.toLowerCase())
}

export function isDateInMonth(date: string, year: number, month: number) {
  return date.slice(0, 7) === `${year}-${String(month).padStart(2, '0')}`
}

export function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

export function getMonthBounds(year: number, month: number) {
  return { first: `${year}-${String(month).padStart(2, '0')}-01`, last: `${year}-${String(month).padStart(2, '0')}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}` }
}

export function normalizeCalendarDate(date: string) {
  return date.slice(0, 10)
}

export function dateAfter(date: string, days: number) {
  return addDays(date, days)
}

export function dateKey(year: number, month: number, day: number) {
  return monthDate(year, month, day)
}

export function monthDays(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function weekday(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function monthName(year: number, month: number) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10)
}

export function displayDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`))
}

export function getOccurrenceKey(orderId: number, date: string) {
  return `${orderId}-${date}`
}

export function filterOccurrencesForDate(occurrences: CalendarMealPrepOccurrence[], date: string) {
  return occurrences.filter((occurrence) => occurrence.fulfillmentDate === date)
}

export function recurringDatesForMonth(order: CalendarMealPrepOrder, year: number, month: number) {
  return expandMealPrepOrdersForMonth([order], year, month).map((occurrence) => occurrence.fulfillmentDate)
}

export function sortOccurrences(occurrences: CalendarMealPrepOccurrence[]) {
  return [...occurrences].sort((a, b) => a.fulfillmentDate.localeCompare(b.fulfillmentDate) || a.id - b.id)
}

export function isActiveOccurrence(order: CalendarMealPrepOccurrence) {
  return order.status.toLowerCase() === 'active'
}

export function isPendingOccurrence(order: CalendarMealPrepOccurrence) {
  return order.status.toLowerCase() === 'pending'
}

export function isPausedOccurrence(order: CalendarMealPrepOccurrence) {
  return order.status.toLowerCase() === 'paused'
}

export function occurrenceCountForDate(occurrences: CalendarMealPrepOccurrence[], date: string) {
  return filterOccurrencesForDate(occurrences, date).length
}

export function uniqueOccurrenceDates(occurrences: CalendarMealPrepOccurrence[]) {
  return [...new Set(occurrences.map((occurrence) => occurrence.fulfillmentDate))]
}

export function orderDateRange(order: CalendarMealPrepOrder) {
  return { start: normalizeCalendarDate(order.nextFulfillmentDate), end: dateAfter(normalizeCalendarDate(order.nextFulfillmentDate), 28) }
}

export function isOrderVisible(order: CalendarMealPrepOrder) {
  return !order.isArchived && isCalendarMealPrepStatus(order.status)
}

export function filterVisibleOrders(orders: CalendarMealPrepOrder[]) {
  return orders.filter(isOrderVisible)
}

export function occurrenceStatusClass(status: string) {
  const normalized = status.toLowerCase()
  return normalized === 'paused' ? 'muted' : normalized === 'pending' ? 'pending' : 'active'
}

export function occurrenceLabel(order: CalendarMealPrepOccurrence) {
  return `MP ${order.customerName}`
}

export function hasOccurrences(occurrences: CalendarMealPrepOccurrence[]) {
  return occurrences.length > 0
}

export function firstOccurrenceDate(occurrences: CalendarMealPrepOccurrence[]) {
  return sortOccurrences(occurrences)[0]?.fulfillmentDate ?? null
}

export function lastOccurrenceDate(occurrences: CalendarMealPrepOccurrence[]) {
  return sortOccurrences(occurrences).at(-1)?.fulfillmentDate ?? null
}

export function occurrenceDates(occurrences: CalendarMealPrepOccurrence[]) {
  return sortOccurrences(occurrences).map((occurrence) => occurrence.fulfillmentDate)
}

export function occurrencesForOrder(occurrences: CalendarMealPrepOccurrence[], id: number) {
  return occurrences.filter((occurrence) => occurrence.id === id)
}

export function occurrenceSummary(order: CalendarMealPrepOccurrence) {
  return `${order.customerName} · ${order.mealsPerCycle} meals`
}

export function orderIsPaused(order: CalendarMealPrepOrder) {
  return order.status.toLowerCase() === 'paused'
}

export function orderIsPending(order: CalendarMealPrepOrder) {
  return order.status.toLowerCase() === 'pending'
}

export function orderIsActive(order: CalendarMealPrepOrder) {
  return order.status.toLowerCase() === 'active'
}

export function dateIsValid(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

export function sameDate(a: string, b: string) {
  return normalizeCalendarDate(a) === normalizeCalendarDate(b)
}

export function occurrenceDatesForMonth(orders: CalendarMealPrepOrder[], year: number, month: number) {
  return expandMealPrepOrdersForMonth(orders, year, month)
}

export function calendarMonthId(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function countMore(items: unknown[], visible = 3) {
  return Math.max(0, items.length - visible)
}

export function visibleItems<T>(items: T[], visible = 3) {
  return items.slice(0, visible)
}

export function emptyIfNull<T>(items: T[] | null | undefined) {
  return items ?? []
}

export function toDateString(value: unknown) {
  return String(value ?? '').slice(0, 10)
}

export function statusTone(status: string) {
  return occurrenceStatusClass(status)
}

export function monthStart(year: number, month: number) {
  return monthDate(year, month, 1)
}

export function monthEnd(year: number, month: number) {
  return getMonthBounds(year, month).last
}

export function inMonth(date: string, year: number, month: number) {
  return date >= monthStart(year, month) && date <= monthEnd(year, month)
}

export function occurrenceKey(order: CalendarMealPrepOccurrence) {
  return getOccurrenceKey(order.id, order.fulfillmentDate)
}

export function orderStatus(order: CalendarMealPrepOrder) {
  return order.status.toLowerCase()
}

export function isRecurring(order: CalendarMealPrepOrder) {
  return ['weekly', 'biweekly'].includes(order.recurrencePattern.toLowerCase())
}

export function occurrenceText(order: CalendarMealPrepOccurrence) {
  return `${order.customerName} · ${statusLabel(order.status)}`
}

export function mealPrepColor(status: string) {
  return status.toLowerCase() === 'paused' ? 'muted' : 'blue'
}

export function mealPrepStatus(status: string) {
  return statusLabel(status)
}

export function getOrderId(order: CalendarMealPrepOrder) {
  return order.id
}

export function isMealPrep(order: CalendarMealPrepOrder) {
  return Boolean(order)
}

export function occurrenceDate(order: CalendarMealPrepOccurrence) {
  return order.fulfillmentDate
}

export function orderCustomer(order: CalendarMealPrepOrder) {
  return order.customerName
}

export function orderMeals(order: CalendarMealPrepOrder) {
  return order.mealsPerCycle
}

export function orderRecurrence(order: CalendarMealPrepOrder) {
  return order.recurrencePattern
}

export function orderStatusText(order: CalendarMealPrepOrder) {
  return statusLabel(order.status)
}

export function monthIndex(date: Date) {
  return date.getUTCMonth() + 1
}

export function yearValue(date: Date) {
  return date.getUTCFullYear()
}

export function firstWeekday(year: number, month: number) {
  return weekday(year, month, 1)
}

export function currentMonth() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function isToday(date: string) {
  return date === todayUtc()
}

export function dateParts(date: string) {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  return { year, month, day }
}

export function toMonthDate(date: Date) {
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

export function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

export function dateForDay(year: number, month: number, day: number) {
  return monthDate(year, month, day)
}

export function occurrenceCount(occurrences: CalendarMealPrepOccurrence[]) {
  return occurrences.length
}

export function sameMonth(a: string, year: number, month: number) {
  return isDateInMonth(a, year, month)
}

export function orderHasDate(order: CalendarMealPrepOrder, date: string, year: number, month: number) {
  return recurringDatesForMonth(order, year, month).includes(date)
}

export function monthOccurrences(orders: CalendarMealPrepOrder[], year: number, month: number) {
  return sortOccurrences(expandMealPrepOrdersForMonth(orders, year, month))
}

export function orderDisplayName(order: CalendarMealPrepOrder) {
  return order.customerName || `Order #${order.id}`
}

export function formatMeals(meals: number) {
  return `${meals} meals`
}

export function isStatus(status: string, expected: string) {
  return status.toLowerCase() === expected
}

export function hasStatus(order: CalendarMealPrepOrder, expected: string) {
  return isStatus(order.status, expected)
}

export function orderSummary(order: CalendarMealPrepOrder) {
  return `${orderDisplayName(order)} · ${formatMeals(order.mealsPerCycle)}`
}

export function occurrenceSummaryText(order: CalendarMealPrepOccurrence) {
  return orderSummary(order)
}

export function dateRangeForMonth(year: number, month: number) {
  return getMonthBounds(year, month)
}

export function toUtcDate(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`)
}

export function formatDateUtc(date: string) {
  return displayDate(date)
}

export function isValidStatus(status: string) {
  return isCalendarMealPrepStatus(status) || ['cancelled', 'rejected'].includes(status.toLowerCase())
}

export function orderVisibleInMonth(order: CalendarMealPrepOrder, year: number, month: number) {
  return expandMealPrepOrdersForMonth([order], year, month).length > 0
}

export function monthOccurrenceMap(orders: CalendarMealPrepOrder[], year: number, month: number) {
  return new Map(uniqueOccurrenceDates(monthOccurrences(orders, year, month)).map((date) => [date, monthOccurrences(orders, year, month).filter((item) => item.fulfillmentDate === date)]))
}

export function occurrenceNames(occurrences: CalendarMealPrepOccurrence[]) {
  return occurrences.map((occurrence) => occurrence.customerName)
}

export function orderCount(orders: CalendarMealPrepOrder[]) {
  return orders.length
}

export function occurrenceCountForMonth(orders: CalendarMealPrepOrder[], year: number, month: number) {
  return expandMealPrepOrdersForMonth(orders, year, month).length
}

export function isOrderArchived(order: CalendarMealPrepOrder) {
  return Boolean(order.isArchived)
}

export function filterByStatus(orders: CalendarMealPrepOrder[], status: string) {
  return orders.filter((order) => order.status.toLowerCase() === status.toLowerCase())
}

export function orderDate(order: CalendarMealPrepOrder) {
  return order.nextFulfillmentDate.slice(0, 10)
}

export function occurrenceDateLabel(order: CalendarMealPrepOccurrence) {
  return displayDate(order.fulfillmentDate)
}

export function isDateOnOrAfter(a: string, b: string) {
  return normalizeCalendarDate(a) >= normalizeCalendarDate(b)
}

export function isDateOnOrBefore(a: string, b: string) {
  return normalizeCalendarDate(a) <= normalizeCalendarDate(b)
}

export function dateDifference(a: string, b: string) {
  return Math.round((toUtcDate(a).getTime() - toUtcDate(b).getTime()) / 86400000)
}

export function occurrenceIds(occurrences: CalendarMealPrepOccurrence[]) {
  return occurrences.map((occurrence) => occurrence.id)
}

export function orderIds(orders: CalendarMealPrepOrder[]) {
  return orders.map((order) => order.id)
}

export function sortOrders(orders: CalendarMealPrepOrder[]) {
  return [...orders].sort((a, b) => a.nextFulfillmentDate.localeCompare(b.nextFulfillmentDate) || a.id - b.id)
}

export function firstDayOfMonth(year: number, month: number) {
  return weekday(year, month, 1)
}

export function occurrenceForDate(occurrences: CalendarMealPrepOccurrence[], date: string) {
  return filterOccurrencesForDate(occurrences, date)
}

export function shortStatus(status: string) {
  return statusLabel(status)
}

export function orderTypeLabel() {
  return 'Meal prep'
}

export function isMonthDate(date: string) {
  return dateIsValid(date)
}

export function getMonthNumber(date: Date) {
  return date.getMonth() + 1
}

export function getYearNumber(date: Date) {
  return date.getFullYear()
}

export function monthLabel(date: Date) {
  return monthName(getYearNumber(date), getMonthNumber(date))
}

export function moveMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

export function occurrenceVisibleCount(items: unknown[]) {
  return Math.min(3, items.length)
}

export function moreLabel(items: unknown[]) {
  return items.length > 3 ? `+${items.length - 3} more` : ''
}

export function orderLabel(order: CalendarMealPrepOrder) {
  return `MP ${orderDisplayName(order)}`
}

export function statusBadgeClass(status: string) {
  const tone = status.toLowerCase()
  return tone === 'active' ? 'bg-green-100 text-green-800' : tone === 'paused' ? 'bg-slate-100 text-slate-700' : 'bg-yellow-100 text-yellow-800'
}

export function mealPrepChipClass(status: string) {
  return status.toLowerCase() === 'paused' ? 'border border-dashed border-slate-300 bg-slate-100 text-slate-500' : status.toLowerCase() === 'pending' ? 'border border-dashed border-blue-300 bg-blue-50 text-blue-700' : 'bg-blue-100 text-blue-800'
}

export function eventChipClass() {
  return 'bg-primary/20 text-primary'
}

export function legendItems() {
  return ['Catering', 'Meal prep', 'Pending']
}

export function selectionDate(year: number, month: number, day: number) {
  return dateKey(year, month, day)
}

export function selectedOrToday(selected: string | null) {
  return selected ?? todayUtc()
}

export function dateHeading(date: string) {
  return displayDate(date)
}

export function isOccurrence(order: CalendarMealPrepOccurrence) {
  return order.fulfillmentDate.length === 10
}

export function occurrenceStatusClassName(status: string) {
  return mealPrepChipClass(status)
}

export function statusBadge(status: string) {
  return statusBadgeClass(status)
}

export function calendarDateKey(year: number, month: number, day: number) {
  return selectionDate(year, month, day)
}

export function getOrderOccurrences(order: CalendarMealPrepOrder, year: number, month: number) {
  return expandMealPrepOrdersForMonth([order], year, month)
}

export function getCalendarOccurrences(orders: CalendarMealPrepOrder[], year: number, month: number) {
  return monthOccurrences(orders, year, month)
}

export function getDayOccurrences(occurrences: CalendarMealPrepOccurrence[], date: string) {
  return occurrenceForDate(occurrences, date)
}

export function getOverflowCount(items: unknown[]) {
  return countMore(items)
}

export function getVisibleItems<T>(items: T[]) {
  return visibleItems(items)
}

export function getOrderStatus(order: CalendarMealPrepOrder) {
  return orderStatus(order)
}

export function getOrderCustomer(order: CalendarMealPrepOrder) {
  return orderCustomer(order)
}

export function getOrderMeals(order: CalendarMealPrepOrder) {
  return orderMeals(order)
}

export function getOrderDate(order: CalendarMealPrepOrder) {
  return orderDate(order)
}

export function getOrderRecurrence(order: CalendarMealPrepOrder) {
  return orderRecurrence(order)
}

export function getOrderLabel(order: CalendarMealPrepOrder) {
  return orderLabel(order)
}

export function getStatusBadge(status: string) {
  return statusBadge(status)
}

export function getMealPrepChip(status: string) {
  return mealPrepChipClass(status)
}

export function getEventChip() {
  return eventChipClass()
}

export function getLegend() {
  return legendItems()
}

export function getMonthLabel(date: Date) {
  return monthLabel(date)
}

export function getFirstDay(year: number, month: number) {
  return firstDayOfMonth(year, month)
}

export function getDays(year: number, month: number) {
  return monthDays(year, month)
}

export function getDateKey(year: number, month: number, day: number) {
  return dateKey(year, month, day)
}

export function getDisplayDate(date: string) {
  return displayDate(date)
}

export function getStatusLabel(status: string) {
  return statusLabel(status)
}
