import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { checkOrderSufficiencyWithAllocations } from '@/lib/macroflex'
import { createNotification, hasNotificationForToday } from '@/lib/notifications'
import { addDays, orderPrepWindow, servingsForBookingItem, servingsForOrder } from '@/lib/rules/allocation'
import { formatQuantity } from '@/lib/rules/quantity-format'

export const dynamic = 'force-dynamic'

function todayInManila() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
}

function prepStartDate(eventDate: string, prepDays: number): string {
  return addDays(eventDate, -Math.max(0, prepDays))
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = todayInManila()
  const { data: bookings, error } = await admin
    .from('BOOKING')
    .select('BookingID, OperatorID, EventDate, GuestCount')
    .eq('Status', 'confirmed')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: preparationLogs, error: preparationError } = await admin.from('PREPARATION_LOG').select('BookingID, MealPrepOrderID, CycleDate')
  if (preparationError) return NextResponse.json({ error: preparationError.message }, { status: 500 })
  const preparedBookings = new Set((preparationLogs ?? []).filter((row) => row.BookingID != null).map((row) => Number(row.BookingID)))
  const preparedCycles = new Set((preparationLogs ?? []).filter((row) => row.MealPrepOrderID != null && row.CycleDate).map((row) => `${Number(row.MealPrepOrderID)}:${String(row.CycleDate).slice(0, 10)}`))

  let checked = 0
  let notified = 0
  let mealPrepChecked = 0
  let mealPrepNotified = 0
  for (const booking of bookings ?? []) {
    if (preparedBookings.has(Number(booking.BookingID))) continue
    const { data: items } = await admin.from('BOOKING_ITEM').select('MenuItemID, Quantity').eq('BookingID', booking.BookingID)
    const menuItemIds = (items ?? []).map((item) => Number(item.MenuItemID))
    if (!menuItemIds.length) continue
    const { data: menuItems } = await admin.from('MENU_ITEM').select('MenuItemID, ItemName, PrepTimeDays').in('MenuItemID', menuItemIds)
    const fulfillmentDate = String(booking.EventDate).slice(0, 10)
    const prepWindow = orderPrepWindow(fulfillmentDate, (menuItems ?? []).map((item) => Number(item.PrepTimeDays ?? 0)))
    if (prepWindow.prepStartDate > today || fulfillmentDate < today) continue
    const result = await checkOrderSufficiencyWithAllocations(
      (items ?? []).map((item) => ({ menuItemId: Number(item.MenuItemID), servings: servingsForBookingItem(item.Quantity, Number(booking.GuestCount)) })),
      servingsForOrder('booking', booking.GuestCount),
      fulfillmentDate,
      { type: 'booking', id: Number(booking.BookingID) },
      admin,
    )
    checked += 1
    const type = result.sufficient ? 'prep_start_confirmed' : 'insufficient_ingredients'
    const metadata = { bookingId: Number(booking.BookingID) }
    if (await hasNotificationForToday(Number(booking.OperatorID), type, metadata)) continue
    const message = result.sufficient
      ? 'Preparation can start for this booking.'
      : `Insufficient ingredients: ${result.shortfalls.map((shortfall) => `${shortfall.ingredientName} short by ${formatQuantity(shortfall.shortBy, shortfall.unitOfMeasure)} (${shortfall.contributingItems.map((item) => item.itemName).join(', ')})`).join(', ')}.`
    if (await createNotification(Number(booking.OperatorID), type, message, metadata)) notified += 1
  }

  const { data: mealPrepOrders, error: mealPrepError } = await admin
    .from('MEAL_PREP_ORDER')
    .select('MealPrepOrderID, OperatorID, RecurrencePattern, MealsPerCycle, NextFulfillmentDate')
    // Only orders that can still be fulfilled are checked.
    .in('Status', ['pending', 'confirmed', 'active'])
    .not('NextFulfillmentDate', 'is', null)
  if (mealPrepError) return NextResponse.json({ error: mealPrepError.message }, { status: 500 })

  for (const order of mealPrepOrders ?? []) {
    const cycleKey = `${Number(order.MealPrepOrderID)}:${String(order.NextFulfillmentDate).slice(0, 10)}`
    const cyclePrepared = preparedCycles.has(cycleKey)
    const { data: items } = await admin
      .from('MEAL_PREP_ITEM')
      .select('MenuItemID, Quantity')
      .eq('MealPrepOrderID', order.MealPrepOrderID)
    const menuItemIds = (items ?? []).map((item) => Number(item.MenuItemID))
    const fulfillmentDate = String(order.NextFulfillmentDate).slice(0, 10)
    const { data: menuItems } = await admin.from('MENU_ITEM').select('MenuItemID, PrepTimeDays').in('MenuItemID', menuItemIds)
    const prepWindow = orderPrepWindow(fulfillmentDate, (menuItems ?? []).map((item) => Number(item.PrepTimeDays ?? 0)))
    if (!cyclePrepared && menuItemIds.length && prepWindow.prepStartDate <= today && fulfillmentDate >= today) {
      const result = await checkOrderSufficiencyWithAllocations(
        menuItemIds.map((menuItemId) => ({ menuItemId })),
        servingsForOrder('meal_prep', undefined, order.MealsPerCycle),
        fulfillmentDate,
        { type: 'meal_prep', id: Number(order.MealPrepOrderID) },
        admin,
      )
      mealPrepChecked += 1
      const type = result.sufficient ? 'prep_start_confirmed' : 'insufficient_ingredients'
      const metadata = { mealPrepOrderId: Number(order.MealPrepOrderID) }
      if (!(await hasNotificationForToday(Number(order.OperatorID), type, metadata))) {
        const message = result.sufficient
          ? `Preparation can start for meal prep order ${order.MealPrepOrderID}.`
          : `Insufficient ingredients for meal prep order ${order.MealPrepOrderID}: ${result.shortfalls.map((shortfall) => `${shortfall.ingredientName} short by ${formatQuantity(shortfall.shortBy, shortfall.unitOfMeasure)} (${shortfall.contributingItems.map((item) => item.itemName).join(', ')})`).join(', ')}.`
        if (await createNotification(Number(order.OperatorID), type, message, metadata)) mealPrepNotified += 1
      }
    }

    let nextDate = fulfillmentDate
    const step = order.RecurrencePattern === 'biweekly' ? 14 : 7
    while (nextDate <= today) nextDate = addDays(nextDate, step)
    if (nextDate !== fulfillmentDate) {
      const { error: updateError } = await admin
        .from('MEAL_PREP_ORDER')
        .update({ NextFulfillmentDate: nextDate })
        .eq('MealPrepOrderID', order.MealPrepOrderID)
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, checked, notified, mealPrepChecked, mealPrepNotified })
}
