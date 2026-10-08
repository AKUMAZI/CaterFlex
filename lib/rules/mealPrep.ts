import type { Booking, MealPrepFrequency } from '../types';
import { addDays } from './allocation';

export function getUpcomingFulfillmentDates(
  startDate: string,
  frequency: MealPrepFrequency,
  count = 8
): string[] {
  const dates: string[] = [];
  const stepDays = frequency === 'weekly' ? 7 : 14;

  for (let i = 0; i < count; i++) dates.push(addDays(startDate, i * stepDays));

  return dates;
}

export function isMealPrepBooking(booking: Pick<Booking, 'orderType'>): boolean {
  return booking.orderType === 'meal_prep';
}

export function bookingQuantityLabel(booking: Pick<Booking, 'orderType'>): string {
  return isMealPrepBooking(booking) ? 'servings per cycle' : 'guests';
}

export function bookingDisplayTitle(booking: Pick<Booking, 'orderType' | 'eventType'>): string {
  return isMealPrepBooking(booking)
    ? `Meal Prep — ${booking.eventType}`
    : booking.eventType;
}
