'use server'

import { requireRole } from '@/app/actions/auth'
import { createAdminClient } from '@/lib/supabase-admin'

const NOTIFICATION_FIELDS = 'NotificationID, OperatorID, NotificationType, Message, RelatedBookingID, RelatedMealPrepOrderID, IsRead, CreatedAt'

export async function getOwnerNotifications() {
  const owner = await requireRole('owner')
  if (!owner) return { ok: false as const, error: 'Owner access required.', notifications: [] }

  const { data, error } = await createAdminClient()
    .from('NOTIFICATION')
    .select(NOTIFICATION_FIELDS)
    .eq('OperatorID', Number(owner.id))
    .order('IsRead', { ascending: true })
    .order('CreatedAt', { ascending: false })

  if (error) return { ok: false as const, error: error.message, notifications: [] }
  return { ok: true as const, notifications: data ?? [] }
}

export async function markNotificationRead(notificationId: number) {
  const owner = await requireRole('owner')
  if (!owner) return { ok: false as const, error: 'Owner access required.' }

  const admin = createAdminClient()
  const { data: notification, error: fetchError } = await admin
    .from('NOTIFICATION')
    .select('NotificationID, OperatorID')
    .eq('NotificationID', notificationId)
    .maybeSingle()
  if (fetchError) return { ok: false as const, error: fetchError.message }
  if (!notification || Number(notification.OperatorID) !== Number(owner.id)) {
    return { ok: false as const, error: 'You are not authorized to update this notification.' }
  }

  const { error } = await admin.from('NOTIFICATION').update({ IsRead: true }).eq('NotificationID', notificationId)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
