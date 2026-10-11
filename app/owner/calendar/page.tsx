'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { DashboardLayout } from '@/app/dashboard-layout'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getOwnerCalendarBookings, getOwnerCalendarMealPrep } from '@/app/actions/booking-actions'
import {
  calendarChipClass,
  calendarStatusClass,
  detailItems,
  expandMealPrepOrdersForMonth,
  groupCalendarItemsByDate,
  statusLabel,
  type CalendarBooking,
  type CalendarItem,
  type CalendarMealPrepOccurrence,
} from '@/lib/calendar-meal-prep'

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function itemTitle(item: CalendarItem) {
  return item.kind === 'meal' ? `Meal prep – ${item.name} – ${statusLabel(item.status)}` : `${item.name} – Catering – ${statusLabel(item.status)}`
}

function DayDetailDialog({ date, items, open, onOpenChange }: { date: string | null; items: CalendarItem[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{date ? `Events on ${dateLabel(date)}` : 'Day details'}</DialogTitle></DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {detailItems(items).map((item) => (
            <div key={`${item.kind}-${item.id}`} className={`rounded-lg p-3 text-sm ${calendarChipClass(item)}`}>
              <div className="flex items-center justify-between gap-3"><p className="font-medium">{item.name}</p><span className="text-xs font-medium">{statusLabel(item.status)}</span></div>
              {item.kind === 'meal' ? <p className="mt-1">Meal prep · {item.mealPrep.mealsPerCycle} meals per cycle</p> : <p className="mt-1">{item.booking.EventTime} · {item.booking.GuestCount} guests · {item.booking.Venue}</p>}
              {item.kind === 'meal' && <p className="mt-1 text-xs">Meal prep</p>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CalendarDay({ day, date, items, onOpen }: { day: number; date: string; items: CalendarItem[]; onOpen: () => void }) {
  return (
    <div className="min-h-28 rounded-lg border p-2">
      <button type="button" onClick={onOpen} className="mb-1 text-sm font-medium underline-offset-2 hover:underline" aria-label={`View events for ${dateLabel(date)}`}>{day}</button>
      <div className="flex flex-col gap-1">
        {items.slice(0, 3).map((item) => <div key={`${item.kind}-${item.id}`} title={itemTitle(item)} className={`truncate rounded px-1 py-0.5 text-xs ${calendarChipClass(item)}`}>{item.name}</div>)}
        {items.length > 3 && <button type="button" onClick={onOpen} className="text-left text-xs text-muted-foreground hover:underline">+{items.length - 3} more</button>}
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const [bookings, setBookings] = useState<CalendarBooking[]>([])
  const [mealPrepOrders, setMealPrepOrders] = useState<CalendarMealPrepOccurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [bookingResult, mealPrepResult] = await Promise.all([getOwnerCalendarBookings(), getOwnerCalendarMealPrep()])
        if (!bookingResult.ok) throw new Error(bookingResult.error)
        if (!mealPrepResult.ok) throw new Error(mealPrepResult.error)
        setBookings(bookingResult.bookings)
        setMealPrepOrders(expandMealPrepOrdersForMonth(mealPrepResult.orders, currentDate.getFullYear(), currentDate.getMonth() + 1))
        setErrorMessage('')
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load calendar.')
      } finally { setLoading(false) }
    }
    load()
  }, [currentDate])

  const monthName = currentDate.toLocaleString(undefined, { month: 'long', year: 'numeric' })
  const days = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()
  const today = new Date().toISOString().slice(0, 10)
  const grouped = useMemo(() => groupCalendarItemsByDate(bookings, mealPrepOrders), [bookings, mealPrepOrders])
  const upcoming = useMemo(() => Object.values(grouped).flat().filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5), [grouped, today])
  const dateForDay = (day: number) => `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  return <DashboardLayout><main className="flex flex-col gap-8">
    <header><h1 className="font-heading text-3xl font-bold text-surface-foreground">Calendar</h1><p className="mt-2 text-surface-muted-foreground">View all events scheduled for {monthName}</p></header>
    {errorMessage && <Card className="border-destructive/40 bg-destructive/10 p-4"><p className="text-sm text-destructive">{errorMessage}</p></Card>}
    <Card className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><h2 className="font-heading text-2xl font-bold text-card-foreground">{monthName}</h2><div className="flex items-center gap-2"><button type="button" aria-label="View previous month" onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="rounded-md border p-2"><ChevronLeft /></button><button type="button" onClick={() => { const d = new Date(); setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1)) }} className="rounded-md border px-3 py-2 text-sm">Today</button><button type="button" aria-label="View next month" onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="rounded-md border p-2"><ChevronRight /></button><Calendar className="ml-2 text-primary" /></div></div>
      <div className="mb-5 flex flex-wrap gap-4 text-xs"><span><i className="mr-1 inline-block size-2 rounded-full bg-primary" />Catering</span><span><i className="mr-1 inline-block size-2 rounded-full bg-teal-600" />Meal prep</span><span><i className="mr-1 inline-block size-2 rounded-full border border-dashed border-yellow-600" />Pending</span></div>
      {loading ? <p className="py-12 text-center text-muted-foreground">Loading bookings...</p> : <><div className="mb-3 grid grid-cols-7 gap-2">{dayLabels.map((day) => <div key={day} className="py-2 text-center font-semibold text-muted-foreground">{day}</div>)}</div><div className="grid grid-cols-7 gap-2">{Array.from({ length: firstDay }, (_, i) => <div key={`empty-${i}`} className="aspect-square" />)}{Array.from({ length: days }, (_, i) => { const date = dateForDay(i + 1); return <CalendarDay key={date} day={i + 1} date={date} items={grouped[date] ?? []} onOpen={() => setSelectedDate(date)} /> })}</div></>}
    </Card>
    <Card className="p-8"><h2 className="mb-6 font-heading text-lg font-bold">Upcoming Events</h2>{loading ? <p className="text-sm text-muted-foreground">Loading upcoming events...</p> : <div className="flex flex-col gap-3">{upcoming.map((item) => <div key={`${item.kind}-${item.id}-${item.date}`} className="flex items-center justify-between rounded-lg bg-muted/50 p-4"><div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.kind === 'meal' ? `Meal prep · ${item.mealPrep.mealsPerCycle} meals per cycle` : `Catering · ${item.booking.EventTime} · ${item.booking.GuestCount} guests`}</p>{item.kind === 'catering' && <p className="mt-1 text-xs text-muted-foreground">{item.booking.Venue}</p>}</div><div className="text-right"><p className="text-sm font-medium">{dateLabel(item.date)}</p><span className={`mt-1 inline-block rounded-full px-2 py-1 text-xs font-medium ${calendarStatusClass(item.status)}`}>{statusLabel(item.status)}</span></div></div>)}</div>}</Card>
    <DayDetailDialog date={selectedDate} items={selectedDate ? grouped[selectedDate] ?? [] : []} open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)} />
  </main></DashboardLayout>
}
