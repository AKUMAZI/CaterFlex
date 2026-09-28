import type {
  Booking,
  Ingredient,
  MenuItem,
  OperatorSettings,
  OrderType,
} from '../types';
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
  valid: boolean;
  failures: BookingRuleFailure[];
}

export interface DateAvailability {
  available: boolean;
  reason?: string;
  remainingCapacity?: number;
}

/**
 * Checks whether a booking falls within the operator's
 * configured operating days and hours.
 */
function validateOperatingAvailability(
  booking: Booking,
  settings: OperatorSettings
): BookingRuleFailure | null {
  const eventDate = new Date(`${booking.eventDate}T00:00:00`);

  if (Number.isNaN(eventDate.getTime())) {
    return {
      rule: 'operatingAvailability',
      message: 'The selected event date is invalid.',
    };
  }

  const dayOfWeek = eventDate.getDay();

  // Check operating day
  if (!settings.operatingDays.includes(dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6)) {
    return {
      rule: 'operatingAvailability',
      message: 'The selected date is outside the operator\'s operating days.',
    };
  }

  // Check operating hours
  const eventTime = booking.eventTime;

  if (
    eventTime < settings.operatingHoursStart ||
    eventTime > settings.operatingHoursEnd
  ) {
    return {
      rule: 'operatingAvailability',
      message: `The selected time (${eventTime}) is outside operating hours (${settings.operatingHoursStart}–${settings.operatingHoursEnd}).`,
    };
  }

  return null;
}

/**
 * Checks whether the guest count is within the operator's
 * maximum allowed guests per event.
 *
 * The value comes from:
 * OPERATOR_SETTINGS.MaxGuestCountPerEvent
 *
 * and is mapped into:
 * settings.maxGuestsPerEvent
 */
function validateGuestCount(
  booking: Booking,
  settings: OperatorSettings
): BookingRuleFailure | null {
  if (booking.guestCount > settings.maxGuestsPerEvent) {
    return {
      rule: 'guestCount',
      message: `Guest count (${booking.guestCount}) exceeds the maximum allowed guests per event (${settings.maxGuestsPerEvent}).`,
    };
  }

  return null;
}

/**
 * Determines whether a booking should occupy an operator's
 * daily capacity.
 *
 * Pending and confirmed bookings occupy capacity.
 * Rejected and completed bookings do not.
 */
function occupiesCapacity(status: Booking['status']): boolean {
  return status === 'pending' || status === 'confirmed';
}

/**
 * Counts catering bookings occupying capacity on a specific date.
 */
function countCateringBookingsForDate(
  bookings: Booking[],
  eventDate: string
): number {
  return bookings.filter(
    (booking) =>
      booking.orderType === 'catering' &&
      booking.eventDate === eventDate &&
      occupiesCapacity(booking.status)
  ).length;
}

/**
 * Counts meal-prep bookings occupying capacity on a specific date.
 */
function countMealPrepBookingsForDate(
  bookings: Booking[],
  eventDate: string
): number {
  return bookings.filter(
    (booking) =>
      isMealPrepBooking(booking) &&
      booking.eventDate === eventDate &&
      occupiesCapacity(booking.status)
  ).length;
}

/**
 * Checks daily catering-event capacity.
 */
function validateCateringDailyCapacity(
  booking: Booking,
  bookings: Booking[],
  settings: OperatorSettings
): BookingRuleFailure | null {
  const eventDate = new Date(`${booking.eventDate}T00:00:00`);

  if (Number.isNaN(eventDate.getTime())) {
    return null;
  }

  const dayOfWeek = eventDate.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  const maxEvents =
    settings.maxEventsPerDay[dayOfWeek] ?? 0;

  const currentBookings = countCateringBookingsForDate(
    bookings,
    booking.eventDate
  );

  if (currentBookings >= maxEvents) {
    return {
      rule: 'dailyCapacity',
      message: `The operator has already reached the maximum number of catering events for this date (${currentBookings}/${maxEvents}).`,
    };
  }

  return null;
}

/**
 * Checks daily meal-prep capacity.
 */
function validateMealPrepDailyCapacity(
  booking: Booking,
  bookings: Booking[],
  settings: OperatorSettings
): BookingRuleFailure | null {
  const eventDate = new Date(`${booking.eventDate}T00:00:00`);

  if (Number.isNaN(eventDate.getTime())) {
    return null;
  }

  const dayOfWeek = eventDate.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  const maxMealPrepOrders =
    settings.maxMealPrepFulfillmentsPerDay[dayOfWeek] ?? 0;

  const currentMealPrepBookings = countMealPrepBookingsForDate(
    bookings,
    booking.eventDate
  );

  if (currentMealPrepBookings >= maxMealPrepOrders) {
    return {
      rule: 'mealPrepCapacity',
      message: `The operator has already reached the maximum number of meal-prep orders for this date (${currentMealPrepBookings}/${maxMealPrepOrders}).`,
    };
  }

  return null;
}

/**
 * Checks whether the customer's dietary restrictions conflict
 * with the selected menu items.
 */
function validateAllergenConflicts(
  booking: Booking,
  menuItems: MenuItem[]
): BookingRuleFailure | null {
  if (!booking.dietaryRestrictions?.length) {
    return null;
  }

  const selectedItems = menuItems.filter((item) =>
    booking.selectedMenuItemIds.includes(item.id)
  );

  const conflicts = selectedItems.flatMap((item) =>
    item.allergyTags.filter((allergen) =>
      booking.dietaryRestrictions.includes(allergen)
    )
  );

  const uniqueConflicts = [...new Set(conflicts)];

  if (uniqueConflicts.length > 0) {
    return {
      rule: 'allergenConflict',
      message: `Selected menu items contain allergen(s) matching the customer's dietary restrictions: ${uniqueConflicts.join(', ')}.`,
    };
  }

  return null;
}

/**
 * Checks whether the required ingredients are sufficient
 * for the selected menu items.
 */
function validateIngredientSufficiency(
  booking: Booking,
  menuItems: MenuItem[],
  ingredients: Ingredient[]
): BookingRuleFailure | null {
  if (!ingredients.length) {
    return null;
  }

  const selectedItems = menuItems.filter((item) =>
    booking.selectedMenuItemIds.includes(item.id)
  );

  const insufficientIngredients: string[] = [];

  for (const menuItem of selectedItems) {
    for (const requiredIngredient of menuItem.requiredIngredients ?? []) {
      const ingredient = ingredients.find(
        (item) => item.id === requiredIngredient.id
      );

      if (!ingredient) {
        continue;
      }

      const requiredQuantity =
        requiredIngredient.qty * booking.guestCount;

      if (ingredient.currentStock < requiredQuantity) {
        insufficientIngredients.push(ingredient.name);
      }
    }
  }

  const uniqueInsufficientIngredients = [
    ...new Set(insufficientIngredients),
  ];

  if (uniqueInsufficientIngredients.length > 0) {
    return {
      rule: 'ingredientSufficiency',
      message: `Insufficient ingredient stock: ${uniqueInsufficientIngredients.join(', ')}.`,
    };
  }

  return null;
}

/**
 * Main booking validation function.
 */
export function validateBooking(
  booking: Booking,
  settings: OperatorSettings,
  bookings: Booking[] = [],
  menuItems: MenuItem[] = [],
  ingredients: Ingredient[] = []
): BookingValidationResult {
  const failures: BookingRuleFailure[] = [];

  // ---------------------------------------------------------
  // 1. Operating day and time
  // ---------------------------------------------------------
  const operatingFailure = validateOperatingAvailability(
    booking,
    settings
  );

  if (operatingFailure) {
    failures.push(operatingFailure);
  }

  // ---------------------------------------------------------
  // 2. Maximum guest count
  // ---------------------------------------------------------
  //
  // Uses:
  // OPERATOR_SETTINGS.MaxGuestCountPerEvent
  //
  // Example:
  // MaxGuestCountPerEvent = 100
  // Customer GuestCount = 120
  //
  // Result:
  // guestCount validation failure
  //
  const guestCountFailure = validateGuestCount(
    booking,
    settings
  );

  if (guestCountFailure) {
    failures.push(guestCountFailure);
  }

  // ---------------------------------------------------------
  // 3. Daily capacity
  // ---------------------------------------------------------
  if (isMealPrepBooking(booking)) {
    const mealPrepCapacityFailure =
      validateMealPrepDailyCapacity(
        booking,
        bookings,
        settings
      );

    if (mealPrepCapacityFailure) {
      failures.push(mealPrepCapacityFailure);
    }
  } else {
    const cateringCapacityFailure =
      validateCateringDailyCapacity(
        booking,
        bookings,
        settings
      );

    if (cateringCapacityFailure) {
      failures.push(cateringCapacityFailure);
    }
  }

  // ---------------------------------------------------------
  // 4. Allergen filtering
  // ---------------------------------------------------------
  const allergenFailure = validateAllergenConflicts(
    booking,
    menuItems
  );

  if (allergenFailure) {
    failures.push(allergenFailure);
  }

  // ---------------------------------------------------------
  // 5. Ingredient sufficiency
  // ---------------------------------------------------------
  const ingredientFailure = validateIngredientSufficiency(
    booking,
    menuItems,
    ingredients
  );

  if (ingredientFailure) {
    failures.push(ingredientFailure);
  }

  return {
    valid: failures.length === 0,
    failures,
  };
}

/**
 * Checks availability for a specific date.
 */
export function getDateAvailability(
  date: string,
  orderType: OrderType,
  settings: OperatorSettings,
  bookings: Booking[]
): DateAvailability {
  const eventDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(eventDate.getTime())) {
    return {
      available: false,
      reason: 'Invalid date.',
    };
  }

  const dayOfWeek = eventDate.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  // ---------------------------------------------------------
  // Check operating day
  // ---------------------------------------------------------
  if (!settings.operatingDays.includes(dayOfWeek)) {
    return {
      available: false,
      reason: 'The operator is not available on this day.',
    };
  }

  // ---------------------------------------------------------
  // Check capacity
  // ---------------------------------------------------------
  if (orderType === 'meal_prep') {
    const maxCapacity =
      settings.maxMealPrepFulfillmentsPerDay[dayOfWeek] ?? 0;

    const currentBookings =
      countMealPrepBookingsForDate(
        bookings,
        date
      );

    const remainingCapacity =
      Math.max(maxCapacity - currentBookings, 0);

    if (currentBookings >= maxCapacity) {
      return {
        available: false,
        reason: `Meal-prep capacity is full (${currentBookings}/${maxCapacity}).`,
        remainingCapacity: 0,
      };
    }

    return {
      available: true,
      remainingCapacity,
    };
  }

  const maxCapacity =
    settings.maxEventsPerDay[dayOfWeek] ?? 0;

  const currentBookings =
    countCateringBookingsForDate(
      bookings,
      date
    );

  const remainingCapacity =
    Math.max(maxCapacity - currentBookings, 0);

  if (currentBookings >= maxCapacity) {
    return {
      available: false,
      reason: `Catering event capacity is full (${currentBookings}/${maxCapacity}).`,
      remainingCapacity: 0,
    };
  }

  return {
    available: true,
    remainingCapacity,
  };
}

/**
 * Finds the next available date within the next 90 days.
 */
export function findNextAvailableDate(
  startDate: string,
  orderType: OrderType,
  settings: OperatorSettings,
  bookings: Booking[]
): string | null {
  const date = new Date(`${startDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  for (let i = 0; i < 90; i++) {
    const dateString = date.toISOString().split('T')[0];

    const availability = getDateAvailability(
      dateString,
      orderType,
      settings,
      bookings
    );

    if (availability.available) {
      return dateString;
    }

    date.setDate(date.getDate() + 1);
  }

  return null;
}