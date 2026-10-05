import { createAdminClient } from '@/lib/supabase-admin'

export type NotificationType =
  | 'new_booking'
  | 'capacity_conflict'
  | 'allergen_conflict'
  | 'insufficient_ingredients'
  | 'prep_start_confirmed'

type NotificationLinks = {
  bookingId?: number
  mealPrepOrderId?: number
}

export async function createNotification(
  operatorId: number,
  type: NotificationType,
  message: string,
  links: NotificationLinks = {},
) {
  const admin = createAdminClient()
  const { error } = await admin.from('NOTIFICATION').insert({
    OperatorID: operatorId,
    NotificationType: type,
    Message: message,
    RelatedBookingID: links.bookingId ?? null,
    RelatedMealPrepOrderID: links.mealPrepOrderId ?? null,
    IsRead: false,
  })

  if (error) {
    console.error('[Notifications] Could not create notification:', error)
    return { ok: false as const, error: error.message }
  }

  return { ok: true as const }
}

export async function createDailyNotificationOnce(
  operatorId: number,
  type: NotificationType,
  message: string,
  links: NotificationLinks = {},
) {
  const admin = createAdminClient()
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  let query = admin
    .from('NOTIFICATION')
    .select('NotificationID')
    .eq('OperatorID', operatorId)
    .eq('NotificationType', type)
    .gte('CreatedAt', startOfDay.toISOString())

  query = links.bookingId !== undefined
    ? query.eq('RelatedBookingID', links.bookingId)
    : query.eq('RelatedMealPrepOrderID', links.mealPrepOrderId ?? -1)

  const { data, error } = await query.limit(1)
  if (error) return { ok: false as const, error: error.message }
  if (data?.length) return { ok: true as const, skipped: true as const }

  return createNotification(operatorId, type, message, links)
}

export function formatShortfallMessage(itemName: string, shortfalls: Array<{ ingredientName: string; shortBy: number; unitOfMeasure: string }>) {
  const details = shortfalls.map((item) => `${item.ingredientName} short by ${item.shortBy} ${item.unitOfMeasure}`).join(', ')
  return `${itemName} cannot start prep because ingredients are insufficient${details ? `: ${details}` : '.'}`
}

export function formatPrepStartDate(date: string, prepTimeDays: number | null | undefined) {
  const result = new Date(`${date}T00:00:00`)
  result.setDate(result.getDate() - Number(prepTimeDays ?? 0))
  return result
}

export function isTodayOrEarlier(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date <= today
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function notificationLabel(type: string) {
  return type.replaceAll('_', ' ')
}

export type OwnerNotification = {
  NotificationID: number
  OperatorID: number
  NotificationType: NotificationType
  Message: string
  RelatedBookingID: number | null
  RelatedMealPrepOrderID: number | null
  IsRead: boolean
  CreatedAt: string
}

export const NOTIFICATION_FIELDS = 'NotificationID, OperatorID, NotificationType, Message, RelatedBookingID, RelatedMealPrepOrderID, IsRead, CreatedAt'

export function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function isSameDate(value: string, date: Date) {
  return value.slice(0, 10) === dateKey(date)
}

export function getPrepStartDate(fulfillmentDate: string, prepTimeDays: number | null | undefined) {
  return formatPrepStartDate(fulfillmentDate, prepTimeDays)
}

export function getTodayDate() {
  return dateKey(new Date())
}

export function getPrepStartDateForToday(prepTimeDays: number | null | undefined) {
  return formatPrepStartDate(getTodayDate(), prepTimeDays)
}

export function getPrepStartDateLabel(fulfillmentDate: string, prepTimeDays: number | null | undefined) {
  return getPrepStartDate(fulfillmentDate, prepTimeDays).toLocaleDateString()
}

export function getNotificationTypeLabel(type: string) {
  return notificationLabel(type)
}

export function getNotificationLink(notification: Pick<OwnerNotification, 'RelatedBookingID' | 'RelatedMealPrepOrderID'>) {
  if (notification.RelatedBookingID) return `/owner/bookings#booking-${notification.RelatedBookingID}`
  if (notification.RelatedMealPrepOrderID) return `/owner/prep-schedule#meal-prep-${notification.RelatedMealPrepOrderID}`
  return null
}
