import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { checkSufficiencyWithAllocations } from '@/lib/macroflex'
import { createNotification, hasNotificationForToday } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

function prepStartDate(eventDate: string, prepDays: number) {
  const date = new Date(`${eventDate}T00:00:00`)
  date.setDate(date.getDate() - Math.max(0, prepDays))
  return date
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const { data: bookings, error } = await admin
    .from('BOOKING')
    .select('BookingID, OperatorID, EventDate, GuestCount')
    .eq('Status', 'confirmed')
    .lte('EventDate', today.toISOString().slice(0, 10))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let checked = 0
  let notified = 0
  let mealPrepChecked = 0
  let mealPrepNotified = 0
  for (const booking of bookings ?? []) {
    const { data: items } = await admin.from('BOOKING_ITEM').select('MenuItemID, Quantity').eq('BookingID', booking.BookingID)
    for (const item of items ?? []) {
      const { data: menuItem } = await admin.from('MENU_ITEM').select('ItemName, PrepTimeDays').eq('MenuItemID', item.MenuItemID).maybeSingle()
      if (!menuItem || prepStartDate(String(booking.EventDate), Number(menuItem.PrepTimeDays ?? 0)) > today) continue
      const fulfillmentDate = String(booking.EventDate).slice(0, 10)
      const prepStart = prepStartDate(fulfillmentDate, Number(menuItem.PrepTimeDays ?? 0)).toISOString().slice(0, 10)
      const result = await checkSufficiencyWithAllocations(Number(item.MenuItemID), Number(item.Quantity ?? booking.GuestCount ?? 1), prepStart, fulfillmentDate, { type: 'booking', id: Number(booking.BookingID) }, admin)
      checked += 1
      const type = result.sufficient ? 'prep_start_confirmed' : 'insufficient_ingredients'
      if (await hasNotificationForToday(Number(booking.OperatorID), type, { bookingId: Number(booking.BookingID) })) continue
      const message = result.sufficient
        ? `Preparation can start for ${menuItem.ItemName}.`
        : `Insufficient ingredients for ${menuItem.ItemName}: ${result.shortfalls.map((shortfall) => `${shortfall.ingredientName} short by ${shortfall.shortBy} ${shortfall.unitOfMeasure}`).join(', ')}.`
      if (await createNotification(Number(booking.OperatorID), type, message, { bookingId: Number(booking.BookingID) })) notified += 1
    }
  }

  const { data: mealPrepOrders, error: mealPrepError } = await admin
    .from('MEAL_PREP_ORDER')
    .select('MealPrepOrderID, OperatorID, RecurrencePattern, MealsPerCycle, NextFulfillmentDate')
    // Paused and cancelled orders are intentionally excluded from prep checks and notifications.
    .eq('Status', 'active')
    .not('NextFulfillmentDate', 'is', null)
    .lte('NextFulfillmentDate', today.toISOString().slice(0, 10))
  if (mealPrepError) return NextResponse.json({ error: mealPrepError.message }, { status: 500 })

  for (const order of mealPrepOrders ?? []) {
    const { data: items } = await admin
      .from('MEAL_PREP_ITEM')
      .select('MenuItemID, Quantity')
      .eq('MealPrepOrderID', order.MealPrepOrderID)

    for (const item of items ?? []) {
      const fulfillmentDate = String(order.NextFulfillmentDate).slice(0, 10)
      const prepStart = prepStartDate(fulfillmentDate, Number((await admin.from('MENU_ITEM').select('PrepTimeDays').eq('MenuItemID', item.MenuItemID).maybeSingle()).data?.PrepTimeDays ?? 0)).toISOString().slice(0, 10)
      const result = await checkSufficiencyWithAllocations(Number(item.MenuItemID), Number(item.Quantity ?? order.MealsPerCycle ?? 1), prepStart, fulfillmentDate, { type: 'meal_prep', id: Number(order.MealPrepOrderID) }, admin)
      mealPrepChecked += 1
      const type = result.sufficient ? 'prep_start_confirmed' : 'insufficient_ingredients'
      const metadata = { mealPrepOrderId: Number(order.MealPrepOrderID) }
      if (await hasNotificationForToday(Number(order.OperatorID), type, metadata)) continue
      const message = result.sufficient
        ? `Preparation can start for meal prep order ${order.MealPrepOrderID}.`
        : `Insufficient ingredients for meal prep order ${order.MealPrepOrderID}: ${result.shortfalls.map((shortfall) => `${shortfall.ingredientName} short by ${shortfall.shortBy} ${shortfall.unitOfMeasure}`).join(', ')}.`
      if (await createNotification(Number(order.OperatorID), type, message, metadata)) mealPrepNotified += 1
    }

    const nextDate = new Date(`${order.NextFulfillmentDate}T00:00:00`)
    nextDate.setDate(nextDate.getDate() + (order.RecurrencePattern === 'biweekly' ? 14 : 7))
    const { error: updateError } = await admin
      .from('MEAL_PREP_ORDER')
      .update({ NextFulfillmentDate: nextDate.toISOString().slice(0, 10) })
      .eq('MealPrepOrderID', order.MealPrepOrderID)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, checked, notified, mealPrepChecked, mealPrepNotified })
}
