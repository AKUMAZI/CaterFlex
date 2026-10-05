import { createAdminClient } from '@/lib/supabase-admin'

export type NotificationRelation = { bookingId?: number; mealPrepOrderId?: number }

export async function createNotification(operatorId: number, type: string, message: string, relation: NotificationRelation = {}) {
  const admin = createAdminClient()
  const { error } = await admin.from('NOTIFICATION').insert({
    OperatorID: operatorId,
    NotificationType: type,
    Message: message,
    RelatedBookingID: relation.bookingId ?? null,
    RelatedMealPrepOrderID: relation.mealPrepOrderId ?? null,
    IsRead: false,
    CreatedAt: new Date().toISOString(),
  })
  if (error) console.error('[notifications] create failed:', error.message)
  return !error
}

export async function createDailyNotification(operatorId: number, type: string, message: string, relation: NotificationRelation = {}) {
  const admin = createAdminClient()
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const column = relation.bookingId ? 'RelatedBookingID' : 'RelatedMealPrepOrderID'
  const id = relation.bookingId ?? relation.mealPrepOrderId
  const { data } = await admin.from('NOTIFICATION').select('NotificationID').eq('OperatorID', operatorId).eq('NotificationType', type).eq(column, id).gte('CreatedAt', start.toISOString()).limit(1)
  if (data?.length) return true
  return createNotification(operatorId, type, message, relation)
}

export function getPrepStartDate(eventDate: string, prepTimeDays: number) {
  const date = new Date(`${eventDate}T00:00:00`)
  date.setDate(date.getDate() - Math.max(0, Number(prepTimeDays) || 0))
  return date
}

export function isOnOrBeforeToday(date: Date) {
  const today = new Date(); today.setHours(23, 59, 59, 999)
  return date <= today
}

export function formatShortfallMessage(itemName: string, shortfalls: Array<{ ingredientName: string; shortBy: number; unitOfMeasure: string }>) {
  const details = shortfalls.map((item) => `${item.ingredientName} short by ${item.shortBy} ${item.unitOfMeasure}`).join(', ')
  return `${itemName} cannot be prepared with current stock${details ? `: ${details}` : '.'}`
}

export function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function prepScheduleDate(eventDate: string, prepTimeDays: number) {
  return getPrepStartDate(eventDate, prepTimeDays)
}

export function prepScheduleDateIsDue(eventDate: string, prepTimeDays: number) {
  return isOnOrBeforeToday(getPrepStartDate(eventDate, prepTimeDays))
}

export function prepScheduleDateKey(eventDate: string, prepTimeDays: number) {
  return formatDateOnly(getPrepStartDate(eventDate, prepTimeDays))
}

export function notificationDayKey(date = new Date()) {
  return formatDateOnly(date)
}

export function notificationMessage(type: string, itemName: string) {
  return type === 'prep_start_confirmed' ? `${itemName} prep can start; ingredients are sufficient.` : `${itemName} prep is blocked because ingredients are insufficient.`
}

export function notificationRelation(bookingId?: number, mealPrepOrderId?: number) {
  return bookingId ? { bookingId } : { mealPrepOrderId }
}
