import type {
  Alert,
  Booking,
  Ingredient,
  MenuItem,
  OperatorSettings,
  Payment,
} from './types';
import { validateBooking } from './rules/bookingValidation';
import { checkAllergenConflict } from './rules/allergenFiltering';
import {
  checkDishStock,
  getOverPurchasedIngredients,
  getScrapSuggestions,
} from './rules/macroFlex';

export function buildAlerts(state: {
  bookings: Booking[];
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  operatorSettings: OperatorSettings;
}): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  state.bookings.forEach((booking) => {
    if (!booking.validationPassed && booking.status === 'pending') {
      booking.ruleViolations.forEach((message, i) => {
        const type = message.includes('Allergen conflict')
          ? 'allergenMismatch'
          : message.includes('Ingredient shortage')
            ? 'insufficientStock'
            : message.includes('meal-prep capacity')
          ? 'capacityConflict'
          : message.includes('capacity')
            ? 'capacityConflict'
            : message.includes('Guest count') || message.includes('Servings')
              ? 'guestCountConflict'
              : 'dateConflict';
        const prefix =
          booking.orderType === 'meal_prep' ? 'Meal prep' : 'Booking';
        alerts.push({
          id: `alert-rule-${booking.id}-${i}`,
          type,
          severity: 'error',
          message: `${prefix} #${booking.id}: ${message}`,
          relatedBookingId: booking.id,
          timestamp: now,
        });
      });
    }

    booking.selectedMenuItemIds.forEach((menuItemId) => {
      const menuItem = state.menuItems.find((m) => m.id === menuItemId);
      if (!menuItem) return;
      const conflicts = checkAllergenConflict(menuItem, booking.dietaryRestrictions);
      if (conflicts.length > 0) {
        alerts.push({
          id: `alert-${booking.id}-${menuItemId}`,
          type: 'allergenMismatch',
          severity: 'warning',
          message: `Booking #${booking.id} includes items with allergens: ${conflicts.join(', ')}`,
          relatedBookingId: booking.id,
          timestamp: now,
        });
      }
    });
  });

  state.ingredients.forEach((ingredient) => {
    const percent = (ingredient.currentStock / ingredient.maxCapacity) * 100;
    if (percent < 25 && ingredient.currentStock <= ingredient.maxCapacity) {
      alerts.push({
        id: `alert-low-stock-${ingredient.id}`,
        type: 'lowStock',
        severity: 'warning',
        message: `${ingredient.name} inventory at ${ingredient.currentStock}${ingredient.unit} (${Math.round(percent)}% capacity)`,
        relatedItemId: ingredient.id,
        timestamp: now,
      });
    }
  });

  getOverPurchasedIngredients(state.ingredients).forEach((ingredient) => {
    alerts.push({
      id: `alert-over-${ingredient.id}`,
      type: 'overPurchased',
      severity: 'warning',
      message: `${ingredient.name} is over-purchased (${ingredient.currentStock}${ingredient.unit} exceeds max storage of ${ingredient.maxCapacity}${ingredient.unit})`,
      relatedItemId: ingredient.id,
      timestamp: now,
    });
  });

  state.menuItems.forEach((dish) => {
    const { status, shortfalls } = checkDishStock(dish, state.ingredients);
    if (status === 'insufficient' && shortfalls.length > 0) {
      const names = shortfalls.map((s) => s.name).join(', ');
      alerts.push({
        id: `alert-insufficient-${dish.id}`,
        type: 'insufficientStock',
        severity: 'error',
        message: `${dish.name} cannot be prepared — short on: ${names}`,
        relatedItemId: dish.id,
        timestamp: now,
      });
    }
  });

  getScrapSuggestions(state.ingredients, state.menuItems).slice(0, 5).forEach((s) => {
    alerts.push({
      id: `alert-scrap-${s.dishId}-${s.leftoverIngredientId}`,
      type: 'scrapSuggestion',
      severity: 'info',
      message: `Tira-tira: use leftover ${s.leftoverIngredientName} (${s.leftoverQty}${s.unit}) to make ${s.dishName}`,
      relatedItemId: s.dishId,
      timestamp: now,
    });
  });

  return alerts;
}

export function applyBookingValidation(
  booking: Booking,
  settings: OperatorSettings,
  existingBookings: Booking[],
  menuItems: MenuItem[] = [],
  ingredients: Ingredient[] = []
): Booking {
  const validation = validateBooking(
    booking,
    settings,
    existingBookings,
    menuItems,
    ingredients
  );

  return {
    ...booking,
    validationPassed: validation.valid,
    ruleViolations: validation.failures.map((f) => f.message),
  };
}

export function syncMenuInventoryStatus(
  menuItems: MenuItem[],
  ingredients: Ingredient[]
): MenuItem[] {
  return menuItems.map((item) => ({
    ...item,
    inventoryStatus: checkDishStock(item, ingredients).status,
  }));
}
