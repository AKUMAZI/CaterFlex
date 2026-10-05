import { createAdminClient } from '@/lib/supabase-admin'

type NotificationLinks = {
  bookingId?: number
  mealPrepOrderId?: number
}

export async function createNotification(
  operatorId: number,
  type: string,
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
    console.error('[notifications] Could not create notification:', error)
  }

  return !error
}

export async function hasNotificationForToday(
  operatorId: number,
  type: string,
  links: NotificationLinks = {},
) {
  const admin = createAdminClient()
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const { data, error } = await admin
    .from('NOTIFICATION')
    .select('NotificationID')
    .eq('OperatorID', operatorId)
    .eq('NotificationType', type)
    .eq('RelatedBookingID', links.bookingId ?? null)
    .eq('RelatedMealPrepOrderID', links.mealPrepOrderId ?? null)
    .gte('CreatedAt', start.toISOString())
    .limit(1)

  if (error) {
    console.error('[notifications] Could not check duplicate:', error)
    return false
  }
  return (data?.length ?? 0) > 0
}
