'use server'

import { requireRole } from '@/app/actions/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { validateBooking } from '@/lib/rules/bookingValidation'
import type { Booking, DayOfWeek, OperatorSettings } from '@/lib/types'
import { createNotification } from '@/lib/notifications'

const BOOKING_FIELDS = 'BookingID, CustomerID, OperatorID, EventDate, EventTime, Venue, GuestCount, Status, AllergenConflictFlag'
const BOOKING_ITEM_FIELDS = 'BookingItemID, BookingID, MenuItemID, Quantity'

type BookingDetails = {
  eventDate?: string | null
  eventTime?: string | null
  venue?: string | null
  guestCount?: number
  [key: string]: unknown
}

type BookingItemInput = {
  MenuItemID: number
  Quantity?: number
}

type MealPrepOrderDetails = {
  mealPrepFrequency?: string | null
  guestCount?: number
}

function addDaysToDate(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate.toISOString().slice(0, 10)
}

export async function createMealPrepOrder(orderDetails: MealPrepOrderDetails, items: BookingItemInput[]) {
  const customer = await requireRole('customer')
  if (!customer) return { ok: false as const, error: 'Customer access required.' }

  const admin = createAdminClient()
  const customerId = Number(customer.id)
  const selectedMenuItemIds = items.map((item) => Number(item.MenuItemID)).filter(Number.isFinite)

  const { data: customerAllergies, error: customerAllergyError } = await admin
    .from('CUSTOMER_ALLERGY')
    .select('AllergyTagID')
    .eq('CustomerID', customerId)
  if (customerAllergyError) return { ok: false as const, error: customerAllergyError.message }

  const { data: menuItemAllergies, error: menuItemAllergyError } = selectedMenuItemIds.length > 0
    ? await admin.from('MENU_ITEM_ALLERGY').select('MenuItemID, AllergyTagID').in('MenuItemID', selectedMenuItemIds)
    : { data: [], error: null }
  if (menuItemAllergyError) return { ok: false as const, error: menuItemAllergyError.message }

  const allergyTagIds = Array.from(new Set([
    ...(customerAllergies ?? []).map((allergy) => Number(allergy.AllergyTagID)),
    ...(menuItemAllergies ?? []).map((allergy) => Number(allergy.AllergyTagID)),
  ].filter(Number.isFinite)))
  const { data: allergyTags, error: allergyTagError } = allergyTagIds.length > 0
    ? await admin.from('ALLERGY_TAG').select('AllergyTagID, AllergenName').in('AllergyTagID', allergyTagIds)
    : { data: [], error: null }
  if (allergyTagError) return { ok: false as const, error: allergyTagError.message }

  const allergenNamesById = new Map((allergyTags ?? []).map((tag) => [Number(tag.AllergyTagID), String(tag.AllergenName).trim().toLowerCase()]))
  const customerAllergenNames = new Set((customerAllergies ?? []).map((allergy) => allergenNamesById.get(Number(allergy.AllergyTagID))).filter(Boolean))
  const hasAllergenConflict = (menuItemAllergies ?? []).some((allergy) => customerAllergenNames.has(allergenNamesById.get(Number(allergy.AllergyTagID)) ?? ''))
  const mealsPerCycle = Number(orderDetails.guestCount ?? 0)
  const recurrencePattern = String(orderDetails.mealPrepFrequency ?? 'weekly').trim() || 'weekly'
  const nextFulfillmentDate = addDaysToDate(new Date(), recurrencePattern === 'biweekly' ? 14 : 7)

  if (!Number.isFinite(mealsPerCycle) || mealsPerCycle <= 0) {
    return { ok: false as const, error: 'Meals per cycle must be greater than 0.' }
  }
  if (selectedMenuItemIds.length === 0) {
    return { ok: false as const, error: 'Please select at least one valid menu item.' }
  }

  const { data: order, error } = await admin
    .from('MEAL_PREP_ORDER')
    .insert({
      CustomerID: customerId,
      OperatorID: 2,
      RecurrencePattern: recurrencePattern,
      MealsPerCycle: mealsPerCycle,
      Status: 'pending',
      AllergenConflictFlag: hasAllergenConflict,
      NextFulfillmentDate: nextFulfillmentDate,
    })
    .select('MealPrepOrderID')
    .single()
  if (error || !order) return { ok: false as const, error: error?.message ?? 'Unable to create the meal prep order.' }

  const { error: itemError } = await admin.from('MEAL_PREP_ITEM').insert(items.map((item) => ({
    MealPrepOrderID: order.MealPrepOrderID,
    MenuItemID: Number(item.MenuItemID),
    Quantity: Number(item.Quantity ?? 1),
  })))
  if (itemError) {
    await admin.from('MEAL_PREP_ORDER').delete().eq('MealPrepOrderID', order.MealPrepOrderID)
    return { ok: false as const, error: itemError.message }
  }

  return { ok: true as const, mealPrepOrderId: order.MealPrepOrderID }
}

export async function getCustomerMealPrepOrders() {
  const customer = await requireRole('customer')
  if (!customer) return { ok: false as const, error: 'Customer access required.', orders: [], items: [] }

  const admin = createAdminClient()
  const { data: orders, error } = await admin
    .from('MEAL_PREP_ORDER')
    .select('MealPrepOrderID, CustomerID, OperatorID, RecurrencePattern, MealsPerCycle, Status, AllergenConflictFlag, NextFulfillmentDate')
    .eq('CustomerID', Number(customer.id))
    .order('MealPrepOrderID', { ascending: false })
  if (error) return { ok: false as const, error: error.message, orders: [], items: [] }

  const orderIds = (orders ?? []).map((order) => order.MealPrepOrderID)
  if (orderIds.length === 0) return { ok: true as const, orders: orders ?? [], items: [] }

  const { data: items, error: itemError } = await admin
    .from('MEAL_PREP_ITEM')
    .select('MealPrepItemID, MealPrepOrderID, MenuItemID, Quantity')
    .in('MealPrepOrderID', orderIds)
  if (itemError) return { ok: false as const, error: itemError.message, orders: [], items: [] }

  return { ok: true as const, orders: orders ?? [], items: items ?? [] }
}

export async function getCustomerBookings() {
  const customer = await requireRole('customer')
  if (!customer) return { ok: false as const, error: 'Customer access required.', bookings: [], bookingItems: [] }

  const admin = createAdminClient()
  const { data: bookings, error } = await admin.from('BOOKING').select(BOOKING_FIELDS).eq('CustomerID', Number(customer.id)).order('BookingID', { ascending: false })
  if (error) return { ok: false as const, error: error.message, bookings: [], bookingItems: [] }

  const bookingIds = (bookings ?? []).map((booking) => booking.BookingID)
  if (bookingIds.length === 0) return { ok: true as const, bookings: [], bookingItems: [] }

  const { data: bookingItems, error: itemError } = await admin.from('BOOKING_ITEM').select(BOOKING_ITEM_FIELDS).in('BookingID', bookingIds)
  if (itemError) return { ok: false as const, error: itemError.message, bookings: [], bookingItems: [] }

  return { ok: true as const, bookings: bookings ?? [], bookingItems: bookingItems ?? [] }
}

export async function createBooking(bookingDetails: BookingDetails, items: BookingItemInput[]) {
  const customer = await requireRole('customer')
  if (!customer) return { ok: false as const, error: 'Customer access required.' }

  const admin = createAdminClient()
  const customerId = Number(customer.id)
  const selectedMenuItemIds = items.map((item) => Number(item.MenuItemID)).filter(Number.isFinite)

  const { data: customerAllergies, error: customerAllergyError } = await admin
    .from('CUSTOMER_ALLERGY')
    .select('AllergyTagID')
    .eq('CustomerID', customerId)
  if (customerAllergyError) return { ok: false as const, error: customerAllergyError.message }

  const { data: menuItemAllergies, error: menuItemAllergyError } = selectedMenuItemIds.length > 0
    ? await admin.from('MENU_ITEM_ALLERGY').select('AllergyTagID').in('MenuItemID', selectedMenuItemIds)
    : { data: [], error: null }
  if (menuItemAllergyError) return { ok: false as const, error: menuItemAllergyError.message }

  const allergyTagIds = Array.from(new Set([
    ...(customerAllergies ?? []).map((allergy) => Number(allergy.AllergyTagID)),
    ...(menuItemAllergies ?? []).map((allergy) => Number(allergy.AllergyTagID)),
  ].filter(Number.isFinite)))

  const { data: allergyTags, error: allergyTagError } = allergyTagIds.length > 0
    ? await admin.from('ALLERGY_TAG').select('AllergyTagID, AllergenName').in('AllergyTagID', allergyTagIds)
    : { data: [], error: null }
  if (allergyTagError) return { ok: false as const, error: allergyTagError.message }

  const allergenNamesById = new Map((allergyTags ?? []).map((tag) => [Number(tag.AllergyTagID), String(tag.AllergenName).trim().toLowerCase()]))
  const customerAllergenNames = new Set((customerAllergies ?? []).map((allergy) => allergenNamesById.get(Number(allergy.AllergyTagID))).filter(Boolean))
  const hasAllergenConflict = (menuItemAllergies ?? []).some((allergy) => customerAllergenNames.has(allergenNamesById.get(Number(allergy.AllergyTagID)) ?? ''))
  const operatorId = 2
  if (hasAllergenConflict) {
    await createNotification(operatorId, 'allergen_conflict', `A customer attempted a booking with an allergen conflict.`, {})
  }

  const eventDate = String(bookingDetails.eventDate ?? '').trim()
const eventTime = String(bookingDetails.eventTime ?? '').trim()
const venue = String(bookingDetails.venue ?? '').trim()
const guestCount = Number(bookingDetails.guestCount ?? 0)

if (!eventDate) {
  return {
    ok: false as const,
    error: 'Event date is required.',
  }
}

if (!eventTime) {
  return {
    ok: false as const,
    error: 'Event time is required.',
  }
}

if (!venue) {
  return {
    ok: false as const,
    error: 'Venue is required.',
  }
}

if (!Number.isFinite(guestCount) || guestCount <= 0) {
  return {
    ok: false as const,
    error: 'Guest count must be greater than 0.',
  }
}

const [{ data: operatorSettingsRow, error: settingsError }, { data: existingBookingRows, error: existingBookingsError }] = await Promise.all([
  admin
    .from('OPERATOR_SETTINGS')
    .select('OperatorID, DayOfWeek, OperatingStartTime, OperatingEndTime, MaxCateringEventsPerDay, MaxMealPrepOrdersPerDay, MaxGuestCountPerEvent')
    .eq('OperatorID', operatorId),
  admin
    .from('BOOKING')
    .select('BookingID, CustomerID, OperatorID, EventDate, EventTime, Venue, GuestCount, Status')
    .eq('EventDate', eventDate)
    .in('Status', ['pending', 'confirmed']),
])

if (settingsError) return { ok: false as const, error: settingsError.message }
if (existingBookingsError) return { ok: false as const, error: existingBookingsError.message }
if (!operatorSettingsRow?.length) return { ok: false as const, error: 'Operator booking settings are unavailable.' }

const maxEventsPerDay = {} as OperatorSettings['maxEventsPerDay']
const maxMealPrepFulfillmentsPerDay = {} as OperatorSettings['maxMealPrepFulfillmentsPerDay']

for (const row of operatorSettingsRow) {
  const day = Number(row.DayOfWeek) as DayOfWeek
  maxEventsPerDay[day] = Number(row.MaxCateringEventsPerDay ?? 0)
  maxMealPrepFulfillmentsPerDay[day] = Number(row.MaxMealPrepOrdersPerDay ?? 0)
}

const settings: OperatorSettings = {
  operatingDays: Object.keys(maxEventsPerDay).map(Number) as DayOfWeek[],
  operatingHoursStart: String(operatorSettingsRow[0].OperatingStartTime),
  operatingHoursEnd: String(operatorSettingsRow[0].OperatingEndTime),
  maxEventsPerDay,
  maxGuestsPerEvent: Number(operatorSettingsRow[0].MaxGuestCountPerEvent),
  maxMealPrepFulfillmentsPerDay,
}

const candidateBooking = {
  id: 'new-booking',
  customerId: String(customerId),
  customerName: '',
  customerEmail: '',
  orderType: 'catering',
  eventDate,
  eventTime,
  eventType: '',
  venue,
  guestCount,
  specialRequests: '',
  status: 'pending',
  selectedMenuItemIds: selectedMenuItemIds.map(String),
  dietaryRestrictions: [],
  eventProfileId: '',
  totalCost: 0,
  paymentsReceived: 0,
  createdAt: new Date().toISOString(),
  validationPassed: false,
  ruleViolations: [],
} satisfies Booking

const validation = validateBooking(
  candidateBooking,
  settings,
  (existingBookingRows ?? []).map((row) => ({
    ...candidateBooking,
    id: String(row.BookingID),
    customerId: String(row.CustomerID),
    eventDate: String(row.EventDate),
    eventTime: String(row.EventTime),
    venue: String(row.Venue),
    guestCount: Number(row.GuestCount),
    status: String(row.Status) as Booking['status'],
  })),
  [],
  [],
)

if (!validation.valid) {
  await createNotification(operatorId, 'capacity_conflict', `A booking attempt for ${eventDate} at ${eventTime} was blocked: ${validation.failures.map((failure) => failure.message).join(' ')}`)
  return { ok: false as const, error: validation.failures.map((failure) => failure.message).join(' ') }
}

const { data: booking, error } = await admin
  .from('BOOKING')
  .insert({
    CustomerID: customerId,
    OperatorID: 2,
    EventDate: eventDate,
    EventTime: eventTime,
    Venue: venue,
    GuestCount: guestCount,
    Status: 'pending',
    AllergenConflictFlag: hasAllergenConflict,
  })
  .select('BookingID')
  .single()

  if (error || !booking) return { ok: false as const, error: error?.message ?? 'Unable to retrieve the booking ID.' }

  await createNotification(operatorId, 'new_booking', `New booking request for ${eventDate} at ${eventTime}.`, { bookingId: booking.BookingID })

  const { error: itemError } = await admin.from('BOOKING_ITEM').insert(items.map((item) => ({ BookingID: booking.BookingID, MenuItemID: Number(item.MenuItemID), Quantity: Number(item.Quantity ?? 1) })))
  if (itemError) {
    await admin.from('BOOKING').delete().eq('BookingID', booking.BookingID)
    return { ok: false as const, error: itemError.message }
  }

  return { ok: true as const, bookingId: booking.BookingID }
}

export async function getOwnerBookings() {
  const owner = await requireRole('owner')
  if (!owner) return { ok: false as const, error: 'Owner access required.', bookings: [], bookingItems: [], mealPrepOrders: [], mealPrepItems: [] }

  const admin = createAdminClient()
  const operatorId = Number(owner.id)
  const [{ data: bookings, error }, { data: mealPrepOrders, error: mealPrepError }] = await Promise.all([
    admin.from('BOOKING').select(BOOKING_FIELDS).eq('OperatorID', operatorId).order('BookingID', { ascending: false }),
    admin.from('MEAL_PREP_ORDER').select('MealPrepOrderID, CustomerID, OperatorID, RecurrencePattern, MealsPerCycle, Status, AllergenConflictFlag').eq('OperatorID', operatorId).order('MealPrepOrderID', { ascending: false }),
  ])
  if (error) return { ok: false as const, error: error.message, bookings: [], bookingItems: [], mealPrepOrders: [], mealPrepItems: [] }
  if (mealPrepError) return { ok: false as const, error: mealPrepError.message, bookings: [], bookingItems: [], mealPrepOrders: [], mealPrepItems: [] }

  const bookingIds = (bookings ?? []).map((booking) => booking.BookingID)
  const mealPrepOrderIds = (mealPrepOrders ?? []).map((order) => order.MealPrepOrderID)
  const [{ data: bookingItems, error: itemError }, { data: mealPrepItems, error: mealPrepItemError }] = await Promise.all([
    bookingIds.length > 0
      ? admin.from('BOOKING_ITEM').select(BOOKING_ITEM_FIELDS).in('BookingID', bookingIds)
      : Promise.resolve({ data: [], error: null }),
    mealPrepOrderIds.length > 0
      ? admin.from('MEAL_PREP_ITEM').select('MealPrepItemID, MealPrepOrderID, MenuItemID, Quantity').in('MealPrepOrderID', mealPrepOrderIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (itemError) return { ok: false as const, error: itemError.message, bookings: [], bookingItems: [], mealPrepOrders: [], mealPrepItems: [] }
  if (mealPrepItemError) return { ok: false as const, error: mealPrepItemError.message, bookings: [], bookingItems: [], mealPrepOrders: [], mealPrepItems: [] }

  return { ok: true as const, bookings: bookings ?? [], bookingItems: bookingItems ?? [], mealPrepOrders: mealPrepOrders ?? [], mealPrepItems: mealPrepItems ?? [] }
}

export async function updateBookingStatus(bookingId: number, newStatus: 'confirmed' | 'rejected') {
  const owner = await requireRole('owner')
  if (!owner) return { ok: false as const, error: 'Owner access required.' }

  const admin = createAdminClient()
  const { data: booking, error: fetchError } = await admin.from('BOOKING').select('BookingID, OperatorID').eq('BookingID', bookingId).maybeSingle()
  if (fetchError) return { ok: false as const, error: fetchError.message }
  if (!booking || booking.OperatorID !== Number(owner.id)) return { ok: false as const, error: 'You are not authorized to update this booking.' }

  const { error } = await admin.from('BOOKING').update({ Status: newStatus }).eq('BookingID', bookingId)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function updateMealPrepOrderStatus(mealPrepOrderId: number, newStatus: 'active' | 'rejected') {
  const owner = await requireRole('owner')
  if (!owner) return { ok: false as const, error: 'Owner access required.' }

  const admin = createAdminClient()
  const { data: mealPrepOrder, error: fetchError } = await admin
    .from('MEAL_PREP_ORDER')
    .select('MealPrepOrderID, OperatorID')
    .eq('MealPrepOrderID', mealPrepOrderId)
    .maybeSingle()
  if (fetchError) return { ok: false as const, error: fetchError.message }
  if (!mealPrepOrder || mealPrepOrder.OperatorID !== Number(owner.id)) {
    return { ok: false as const, error: 'You are not authorized to update this meal-prep order.' }
  }

  const { error } = await admin
    .from('MEAL_PREP_ORDER')
    .update({ Status: newStatus })
    .eq('MealPrepOrderID', mealPrepOrderId)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
