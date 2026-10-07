import type { Booking, MealPrepFrequency } from '../types';

export function prepStartDate(fulfillmentDate: string, prepTimeDays: number): Date {
  const date = new Date(`${fulfillmentDate.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() - Math.max(0, Number(prepTimeDays) || 0));
  return date;
}

export function getUpcomingFulfillmentDates(
  startDate: string,
  frequency: MealPrepFrequency,
  count = 8
): string[] {
  const dates: string[] = [];
  const stepDays = frequency === 'weekly' ? 7 : 14;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const requestedStart = new Date(`${startDate.slice(0, 10)}T12:00:00`);
  const start = requestedStart > today ? requestedStart : today;

  for (let i = 0; i < count; i++) {
    const next = new Date(start);
    next.setDate(start.getDate() + i * stepDays);
    dates.push(next.toISOString().slice(0, 10));
  }

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
