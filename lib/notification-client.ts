export const NOTIFICATIONS_UPDATED_EVENT = 'caterflex:notifications-updated'

export function formatUnreadBadgeCount(count: number) {
  if (count <= 0) return ''
  return count > 99 ? '99+' : String(count)
}

export function notifyNotificationsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT))
  }
}
