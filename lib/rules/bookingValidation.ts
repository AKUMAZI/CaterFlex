import type { Booking, Ingredient, MenuItem, OperatorSettings } from '../types';
import { isMealPrepBooking } from './mealPrep';

export interface BookingRuleFailure {
  rule:
    | 'operatingAvailability'
    | 'dailyCapacity'
    | 'guestCount'
    | 'mealPrepCapacity'
    | 'allergenConflict'
    | 'ingredientSufficiency';
  message: string;
}

export interface BookingValidationResult {
  passed: boolean;
  failures: BookingRuleFailure[];
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function sameCalendarDate(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function validateOperatingWindow(
  booking: Pick<Booking, 'eventDate' | 'eventTime'>,
  settings: OperatorSettings,
  label: string
): BookingRuleFailure[] {
  const failures: BookingRuleFailure[] = [];
  const eventDate = new Date(`${booking.eventDate}T12:00:00`);
  const dayOfWeek = eventDate.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  if (!settings.operatingDays.includes(dayOfWeek)) {
    failures.push({
      rule: 'operatingAvailability',
      message: `${label} falls on ${DAY_NAMES[dayOfWeek]}, which is outside operating days`,
    });
  }

  const eventMinutes = parseTimeToMinutes(booking.eventTime);
  const startMinutes = parseTimeToMinutes(settings.operatingHoursStart);
  const endMinutes = parseTimeToMinutes(settings.operatingHoursEnd);

  if (eventMinutes < startMinutes || eventMinutes >= endMinutes) {
    failures.push({
      rule: 'operatingAvailability',
      message: `${label} time ${booking.eventTime} is outside operating hours (${settings.operatingHoursStart}–${settings.operatingHoursEnd})`,
    });
  }

  return failures;
}

export function validateBooking(
  booking: Pick<
    Booking,
    | 'eventDate'
    | 'eventTime'
    | 'guestCount'
    | 'id'
    | 'status'
    | 'orderType'
    | 'selectedMenuItemIds'
    | 'dietaryRestrictions'
  >,
  settings: OperatorSettings,
  existingBookings: Booking[],
  options?: { excludeBookingId?: string; menuItems?: MenuItem[]; ingredients?: Ingredient[] }
): BookingValidationResult {
  const failures: BookingRuleFailure[] = [];
  const eventDate = new Date(`${booking.eventDate}T12:00:00`);
  const dayOfWeek = eventDate.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  if (isMealPrepBooking(booking)) {
    const selectedItems = (options?.menuItems ?? []).filter((item) => booking.selectedMenuItemIds.includes(item.id));
    const allergenConflicts = selectedItems.flatMap((item) => item.allergyTags.filter((tag) => booking.dietaryRestrictions.includes(tag)));
    if (allergenConflicts.length > 0) failures.push({ rule: 'allergenConflict', message: `Allergen conflict detected: ${[...new Set(allergenConflicts)].join(', ')}` });
    const shortfalls = selectedItems.flatMap((item) => item.requiredIngredients.filter((required) => {
      const ingredient = options?.ingredients?.find((candidate) => candidate.id === required.id);
      return !ingredient || ingredient.currentStock < required.qty * Math.max(1, booking.guestCount);
    }));
    if (shortfalls.length > 0) failures.push({ rule: 'ingredientSufficiency', message: `Ingredient shortage detected: ${[...new Set(shortfalls.map((item) => item.name))].join(', ')}. Consider a scrap-based alternate.` });
    failures.push(
      ...validateOperatingWindow(booking, settings, 'Fulfillment')
    );

    const confirmedMealPrepOnDate = existingBookings.filter(
      (b) =>
        b.orderType === 'meal_prep' &&
        b.status === 'confirmed' &&
        sameCalendarDate(b.eventDate, booking.eventDate) &&
        b.id !== options?.excludeBookingId
    ).length;

    const mealPrepLimit = settings.maxMealPrepFulfillmentsPerDay[dayOfWeek] ?? 0;
    const projectedMealPrep = confirmedMealPrepOnDate + 1;

    if (projectedMealPrep > mealPrepLimit) {
      failures.push({
        rule: 'mealPrepCapacity',
        message: `${DAY_NAMES[dayOfWeek]} meal-prep capacity is ${mealPrepLimit} fulfillment(s); ${projectedMealPrep} would be scheduled on ${booking.eventDate.slice(0, 10)}`,
      });
    }


    return { passed: failures.length === 0, failures };
  }

  failures.push(...validateOperatingWindow(booking, settings, 'Event'));

  const confirmedCateringOnDate = existingBookings.filter(
    (b) =>
      b.orderType !== 'meal_prep' &&
      b.status === 'confirmed' &&
      sameCalendarDate(b.eventDate, booking.eventDate) &&
      b.id !== options?.excludeBookingId
  ).length;

  const dayLimit = settings.maxEventsPerDay[dayOfWeek] ?? 0;
  const projectedCount = confirmedCateringOnDate + 1;

  if (projectedCount > dayLimit) {
    failures.push({
      rule: 'dailyCapacity',
      message: `${DAY_NAMES[dayOfWeek]} catering capacity is ${dayLimit} event(s); ${projectedCount} would be scheduled on ${booking.eventDate.slice(0, 10)}`,
    });
  }

  if (booking.guestCount > settings.maxGuestsPerEvent) {
    failures.push({
      rule: 'guestCount',
      message: `Guest count (${booking.guestCount}) exceeds maximum of ${settings.maxGuestsPerEvent} per event`,
    });
  }

  return { passed: failures.length === 0, failures };
}
