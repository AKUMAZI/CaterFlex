'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { DashboardLayout } from '@/app/dashboard-layout'
import { Card } from '@/components/ui/card'
import { getCustomersByIds } from '@/app/actions/auth'
import { getOwnerCalendarMealPrep } from '@/app/actions/booking-actions'
import { supabase } from '@/lib/supabase'
import { expandMealPrepOrdersForMonth, statusLabel, type CalendarMealPrepOccurrence } from '@/lib/calendar-meal-prep'

type Booking = { BookingID: number; CustomerID: number; EventDate: string; EventTime: string; Venue: string; GuestCount: number; Status: string; customerName: string }

const OPERATOR_ID = 2
const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [mealPrepOrders, setMealPrepOrders] = useState<CalendarMealPrepOccurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [currentDate, setCurrentDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [{ data, error }, mealPrep] = await Promise.all([
          supabase.from('BOOKING').select('BookingID, CustomerID, EventDate, EventTime, Venue, GuestCount, Status').eq('OperatorID', OPERATOR_ID).order('EventDate'),
          getOwnerCalendarMealPrep(),
        ])
        if (error) throw error
        const customerIds = [...new Set((data ?? []).map((item) => item.CustomerID))]
        const customers = await getCustomersByIds(customerIds)
        if (!customers.ok) throw new Error(customers.error)
        const names = new Map((customers.customers ?? []).map((item) => [item.CustomerID, item.Name]))
        setBookings((data ?? []).map((item) => ({ ...item, customerName: names.get(item.CustomerID) ?? `Customer #${item.CustomerID}` })))
        if (!mealPrep.ok) throw new Error(mealPrep.error)
        setMealPrepOrders(expandMealPrepOrdersForMonth(mealPrep.orders, currentDate.getFullYear(), currentDate.getMonth() + 1))
        setErrorMessage('')
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load calendar.')
      } finally { setLoading(false) }
    }
    load()
  }, [currentDate])

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const days = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = useMemo(() => bookings.filter((b) => b.EventDate.slice(0, 10) >= today).sort((a, b) => a.EventDate.localeCompare(b.EventDate)).slice(0, 5), [bookings, today])
  const dateForDay = (day: number) => `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const bookingsFor = (date: string) => bookings.filter((b) => b.EventDate.slice(0, 10) === date)
  const mealsFor = (date: string) => mealPrepOrders.filter((o) => o.fulfillmentDate === date)
  const statusClass = (status: string) => status === 'active' || status === 'confirmed' ? 'bg-green-100 text-green-800' : status === 'paused' ? 'bg-muted text-muted-foreground' : 'bg-yellow-100 text-yellow-800'

  return <DashboardLayout><div className="flex flex-col gap-8">
    <header><h1 className="font-heading text-3xl font-bold text-surface-foreground">Calendar</h1><p className="mt-2 text-surface-muted-foreground">View all events scheduled for {monthName}</p></header>
    {errorMessage && <Card className="border-red-300 bg-red-50 p-4"><p className="text-sm text-red-700">{errorMessage}</p></Card>}
    <Card className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><h2 className="font-heading text-2xl font-bold text-card-foreground">{monthName}</h2><div className="flex items-center gap-2"><button type="button" aria-label="View previous month" onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="rounded-md border p-2"><ChevronLeft /></button><button type="button" onClick={() => { const d = new Date(); setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1)) }} className="rounded-md border px-3 py-2 text-sm">Today</button><button type="button" aria-label="View next month" onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="rounded-md border p-2"><ChevronRight /></button><Calendar className="ml-2 text-primary" /></div></div>
      <div className="mb-5 flex flex-wrap gap-4 text-xs"><span><i className="mr-1 inline-block size-2 rounded-full bg-primary" />Catering</span><span><i className="mr-1 inline-block size-2 rounded-full bg-teal-600" />Meal prep</span><span><i className="mr-1 inline-block size-2 rounded-full border border-dashed border-yellow-600" />Pending</span></div>
      {loading ? <p className="py-12 text-center text-muted-foreground">Loading bookings...</p> : <><div className="mb-3 grid grid-cols-7 gap-2">{dayLabels.map((d) => <div key={d} className="py-2 text-center font-semibold text-muted-foreground">{d}</div>)}</div><div className="grid grid-cols-7 gap-2">{Array.from({ length: firstDay }, (_, i) => <div key={`empty-${i}`} className="aspect-square" />)}{Array.from({ length: days }, (_, i) => { const date = dateForDay(i + 1); const items = [...bookingsFor(date).map((b) => ({ kind: 'catering' as const, label: b.customerName, status: b.Status, id: b.BookingID })), ...mealsFor(date).map((o) => ({ kind: 'meal' as const, label: o.customerName, status: o.status, id: o.id }))]; return <div key={date} className="min-h-28 rounded-lg border p-2"><div className="mb-1 text-sm font-medium">{i + 1}</div><div className="flex flex-col gap-1">{items.slice(0, 3).map((item, index) => <div key={`${item.kind}-${item.id}-${index}`} title={`${item.label} - ${statusLabel(item.status)}`} className={`truncate rounded px-1 py-0.5 text-xs ${item.kind === 'meal' ? `border border-teal-600/50 bg-teal-100 text-teal-800 ${item.status === 'pending' ? 'border-dashed' : item.status === 'paused' ? 'opacity-60' : ''}` : 'bg-primary/20 text-primary'}`}>{item.kind === 'meal' ? 'MP ' : ''}{item.label}</div>)}{items.length > 3 && <div className="text-xs text-muted-foreground">+{items.length - 3} more</div>}</div></div>})}</div></>}
    </Card>
    <Card className="p-8"><h2 className="mb-6 font-heading text-lg font-bold">Upcoming Events</h2>{loading ? <p className="text-sm text-muted-foreground">Loading upcoming events...</p> : <div className="flex flex-col gap-3">{[...upcoming.map((b) => ({ id: `b-${b.BookingID}`, name: b.customerName, date: b.EventDate, detail: `${b.EventTime} • ${b.GuestCount} guests`, venue: b.Venue, status: b.Status, label: 'Catering' })), ...mealPrepOrders.filter((o) => o.fulfillmentDate >= today).slice(0, 5).map((o) => ({ id: `m-${o.id}-${o.fulfillmentDate}`, name: o.customerName, date: o.fulfillmentDate, detail: `${o.mealsPerCycle} meals per cycle`, venue: '', status: o.status, label: 'Meal prep' }))].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5).map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-4"><div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.label} • {item.detail}</p>{item.venue && <p className="mt-1 text-xs text-muted-foreground">{item.venue}</p>}</div><div className="text-right"><p className="text-sm font-medium">{new Date(`${item.date}T12:00:00Z`).toLocaleDateString()}</p><span className={`mt-1 inline-block rounded-full px-2 py-1 text-xs font-medium ${statusClass(item.status)}`}>{statusLabel(item.status)}</span></div></div>)}</div>}</Card>
  </div></DashboardLayout>
}
