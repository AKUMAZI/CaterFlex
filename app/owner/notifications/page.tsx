'use client'

import { useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { getOwnerNotifications, markNotificationRead } from '@/app/actions/notification-actions'
import { DashboardLayout } from '@/app/dashboard-layout'

export default function OwnerNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  useEffect(() => { getOwnerNotifications().then((result) => { if (result.ok) setNotifications(result.notifications as any[]) }) }, [])

  async function read(id: number) {
    const result = await markNotificationRead(id)
    if (result.ok) setNotifications((current) => current.map((item) => item.NotificationID === id ? { ...item, IsRead: true } : item))
  }

  return <DashboardLayout><section className="mx-auto max-w-3xl"><div className="mb-8 flex items-center gap-3"><Bell className="size-6" /><div><h1 className="text-3xl font-semibold">Notifications</h1><p className="text-muted-foreground">Booking and preparation updates for your operation.</p></div></div><div className="flex flex-col gap-3">{notifications.length === 0 ? <p className="rounded-lg border p-6 text-muted-foreground">You&apos;re all caught up.</p> : notifications.map((item) => <article key={item.NotificationID} className={`flex items-start justify-between gap-4 rounded-lg border p-4 ${item.IsRead ? 'opacity-60' : 'bg-muted/30'}`}><div><p className="font-medium">{item.Message}</p><p className="mt-1 text-xs text-muted-foreground">{item.NotificationType} · {new Date(item.CreatedAt).toLocaleString()}</p></div>{!item.IsRead && <button type="button" aria-label="Mark notification read" className="rounded-md border p-2 hover:bg-muted" onClick={() => read(item.NotificationID)}><Check className="size-4" /></button>}</article>)}</div></section></DashboardLayout>
}
