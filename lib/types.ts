// User and Role Types
export type UserRole = 'owner' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface CustomerRow {
  CustomerID: number;
  Name: string;
  Contact: string;
  Email: string;
  Password: string | null;
}

export interface BusinessOwnerRow {
  OperatorID?: number | string;
  Email: string;
  BusinessName: string;
  OwnerName: string;
  Contact: string;
  Password?: string | null;
}

// Allergen Types
export type AllergenType = 'shellfish' | 'peanuts' | 'dairy' | 'gluten' | 'eggs' | 'soy' | 'tree_nuts' | 'other';

export interface Allergen {
  id: string;
  name: AllergenType;
}

// Menu Item Types
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: 'appetizers' | 'mains' | 'sides' | 'desserts' | 'beverages';
  price: number;
  prepTimeDays: number;
  macros: {
    carbs: number;
    protein: number;
    fat: number;
  };
  allergyTags: AllergenType[];
  requiredIngredients: Array<{
    id: string;
    name: string;
    qty: number;
    unit: string;
  }>;
  inventoryStatus: 'available' | 'limited' | 'insufficient';
}

// Event Profile Types
export interface EventProfile {
  id: string;
  name: string;
  macros: {
    carbs: { min: number; max: number };
    protein: { min: number; max: number };
    fat: { min: number; max: number };
  };
}

// Ingredient Types
export type IngredientCategory = 'meats' | 'dairy' | 'baking' | 'produce' | 'pantry' | 'herbs_spices' | 'other';

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  currentStock: number;
  unit: string;
  maxCapacity: number;
}

// Operator settings (booking rules)
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface OperatorSettings {
  operatingDays: DayOfWeek[];
  operatingHoursStart: string;
  operatingHoursEnd: string;
  maxEventsPerDay: Record<DayOfWeek, number>;
  maxGuestsPerEvent: number;
  maxMealPrepFulfillmentsPerDay: Record<DayOfWeek, number>;
  maxServingsPerMealPrepOrder: number;
}

// Booking Types
export type OrderType = 'catering' | 'meal_prep';
export type MealPrepFrequency = 'weekly' | 'biweekly';
export type FulfillmentMethod = 'pickup' | 'delivery';
export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'completed';

export interface Booking {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  orderType: OrderType;
  eventDate: string;
  eventTime: string;
  eventType: string;
  venue: string;
  guestCount: number;
  mealPrepFrequency?: MealPrepFrequency;
  fulfillmentMethod?: FulfillmentMethod;
  mealPrepStatus?: 'active' | 'paused';
  specialRequests: string;
  status: BookingStatus;
  selectedMenuItemIds: string[];
  dietaryRestrictions: AllergenType[];
  eventProfileId: string;
  totalCost: number;
  paymentsReceived: number;
  createdAt: string;
  confirmedAt?: string;
  validationPassed: boolean;
  ruleViolations: string[];
}

// Alert Types
export type AlertType =
  | 'dateConflict'
  | 'capacityConflict'
  | 'guestCountConflict'
  | 'allergenMismatch'
  | 'macroFlag'
  | 'lowStock'
  | 'overPurchased'
  | 'insufficientStock'
  | 'scrapSuggestion';

export type AlertSeverity = 'info' | 'warning' | 'error';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  relatedBookingId?: string;
  relatedItemId?: string;
  timestamp: string;
}

// Payment Types
export type PaymentType = 'down_payment' | 'partial' | 'full_payment';

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  date: string;
  type: PaymentType;
  notes?: string;
}

export interface Invoice {
  id: string;
  bookingId: string;
  generatedAt: string;
  customerName: string;
  customerEmail: string;
  eventDate: string;
  eventType: string;
  lineItems: Array<{
    name: string;
    unitPrice: number;
    quantity: number;
    total: number;
  }>;
  guestCount: number;
  subtotal: number;
  totalDue: number;
  paymentsMade: number;
  balanceDue: number;
}
