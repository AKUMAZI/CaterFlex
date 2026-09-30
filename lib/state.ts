import { create } from 'zustand';

import { supabase } from './supabase';

import {
  mockOperatorSettings,
  mockMenuItems,
  mockIngredients,
  mockPayments,
  buildInitialBookings,
  buildInitialInvoices,
} from './mockData';

import {
  User,
  UserRole,
  Booking,
  MenuItem,
  Ingredient,
  Alert,
  AllergenType,
  OrderType,
  OperatorSettings,
  Payment,
  Invoice,
} from './types';

import {
  applyBookingValidation,
  buildAlerts,
  syncMenuInventoryStatus,
} from './alerts';

const OPERATOR_ID = 2;

const DAY_OF_WEEK_VALUES = [0, 1, 2, 3, 4, 5, 6] as const;

type OperatorSettingsRow = {
  SettingID: number;
  OperatorID: number | null;
  DayOfWeek: string;
  OperatingStartTime: string | null;
  OperatingEndTime: string | null;
  MaxCateringEventsPerDay: number | null;
  MaxMealPrepOrdersPerDay: number | null;
  MaxGuestCountPerEvent: number | null;
};

function refreshDerivedState(state: {
  bookings: Booking[];
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  operatorSettings: OperatorSettings;
  payments: Payment[];
  invoices: Invoice[];
}) {
  const menuItems = syncMenuInventoryStatus(
    state.menuItems,
    state.ingredients
  );

  const alerts = buildAlerts({
    ...state,
    menuItems,
  });

  return {
    menuItems,
    alerts,
  };
}

/**
 * Converts PostgreSQL time values such as "08:00:00"
 * into the "HH:MM" format expected by the UI.
 */
function timeToHHMM(time: string | null): string {
  if (!time) return '';

  return time.slice(0, 5);
}

/**
 * Converts OPERATOR_SETTINGS database rows into
 * the OperatorSettings structure used by the
 * booking validation system.
 *
 * Database:
 *   one row per day
 *
 * Application:
 *   one settings object containing day-based records
 */
function settingsFromRows(
  rows: OperatorSettingsRow[]
): OperatorSettings {
  const firstRow = rows[0];

  const operatingDays = rows
    .filter(
      (row) => (row.MaxCateringEventsPerDay ?? 0) > 0
    )
    .map(
      (row) =>
        Number(row.DayOfWeek) as
          | 0
          | 1
          | 2
          | 3
          | 4
          | 5
          | 6
    )
    .sort();

  const maxEventsPerDay: Record<
    0 | 1 | 2 | 3 | 4 | 5 | 6,
    number
  > = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };

  const maxMealPrepFulfillmentsPerDay: Record<
    0 | 1 | 2 | 3 | 4 | 5 | 6,
    number
  > = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };

  for (const row of rows) {
    const day = Number(row.DayOfWeek);

    if (
      !DAY_OF_WEEK_VALUES.includes(
        day as (typeof DAY_OF_WEEK_VALUES)[number]
      )
    ) {
      continue;
    }

    const typedDay =
      day as 0 | 1 | 2 | 3 | 4 | 5 | 6;

    maxEventsPerDay[typedDay] =
      row.MaxCateringEventsPerDay ?? 0;

    maxMealPrepFulfillmentsPerDay[typedDay] =
      row.MaxMealPrepOrdersPerDay ?? 0;
  }

  return {
    operatingDays,

    operatingHoursStart: timeToHHMM(
      firstRow?.OperatingStartTime ?? null
    ),

    operatingHoursEnd: timeToHHMM(
      firstRow?.OperatingEndTime ?? null
    ),

    maxEventsPerDay,

    maxGuestsPerEvent:
      firstRow?.MaxGuestCountPerEvent ?? 100,

    maxMealPrepFulfillmentsPerDay,
  };
}

/**
 * Temporary initial data.
 *
 * These remain temporarily because some parts of the
 * application still use Zustand for UI state and alerts.
 *
 * Database-backed pages do not use these values as
 * their source of truth.
 */
const initialBookings = buildInitialBookings();

const initialMenuItems = syncMenuInventoryStatus(
  mockMenuItems,
  mockIngredients
);

const initialInvoices = buildInitialInvoices(
  initialBookings,
  initialMenuItems
);

interface AppState {
  currentRole: UserRole;
  currentUser: User | null;

  setCurrentRole: (role: UserRole) => void;
  setCurrentUser: (user: User | null) => void;

  bookings: Booking[];
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  alerts: Alert[];
  operatorSettings: OperatorSettings;
  payments: Payment[];
  invoices: Invoice[];

  selectedMenuItemIds: string[];
  customerDietaryRestrictions: AllergenType[];
  customerBookingDraft: Partial<Booking>;
  customerOrderType: OrderType;

  toggleRole: () => void;

  /**
   * Still used by Customer Active Orders.
   * This currently updates the local booking state.
   */
  updateBooking: (
    bookingId: string,
    updates: Partial<Booking>
  ) => void;

  /**
   * Loads the current operator settings from Supabase.
   */
  loadOperatorSettings: () => Promise<void>;

  selectMenuItem: (itemId: string) => void;
  deselectMenuItem: (itemId: string) => void;

  setDietaryRestrictions: (
    restrictions: AllergenType[]
  ) => void;

  setCustomerBookingDraft: (
    draft: Partial<Booking>
  ) => void;

  setCustomerOrderType: (
    type: OrderType
  ) => void;

  clearCustomerSession: () => void;

  updateAlerts: (alerts: Alert[]) => void;
  regenerateAlerts: () => void;
}

export const useAppState = create<AppState>(
  (set, get) => ({
    currentRole: 'customer',
    currentUser: null,

    bookings: initialBookings,
    menuItems: initialMenuItems,
    ingredients: mockIngredients,
    operatorSettings: mockOperatorSettings,
    payments: mockPayments,
    invoices: initialInvoices,

    alerts: buildAlerts({
      bookings: initialBookings,
      menuItems: initialMenuItems,
      ingredients: mockIngredients,
      operatorSettings: mockOperatorSettings,
    }),

    selectedMenuItemIds: [],
    customerDietaryRestrictions: [],
    customerBookingDraft: {},
    customerOrderType: 'catering',

    setCurrentRole: (role) =>
      set({
        currentRole: role,
      }),

    setCurrentUser: (user) =>
      set({
        currentUser: user,
      }),

    /**
     * Loads OPERATOR_SETTINGS from Supabase.
     */
    loadOperatorSettings: async () => {
      const { data, error } = await supabase
        .from('OPERATOR_SETTINGS')
        .select(`
          SettingID,
          OperatorID,
          DayOfWeek,
          OperatingStartTime,
          OperatingEndTime,
          MaxCateringEventsPerDay,
          MaxMealPrepOrdersPerDay,
          MaxGuestCountPerEvent
        `)
        .eq('OperatorID', OPERATOR_ID)
        .order('DayOfWeek');

      if (error) {
        console.error(
          'Failed to load OPERATOR_SETTINGS:',
          error
        );
        return;
      }

      if (!data || data.length === 0) {
        console.error(
          `No OPERATOR_SETTINGS rows found for OperatorID ${OPERATOR_ID}.`
        );
        return;
      }

      const operatorSettings =
        settingsFromRows(
          data as OperatorSettingsRow[]
        );

      const state = get();

      /*
       * Revalidate existing local bookings using
       * the newly loaded database settings.
       */
      const bookings = state.bookings.map(
        (booking) =>
          applyBookingValidation(
            booking,
            operatorSettings,
            state.bookings,
            state.menuItems,
            state.ingredients
          )
      );

      const next = {
        ...state,
        operatorSettings,
        bookings,
      };

      set({
        operatorSettings,
        bookings,
        ...refreshDerivedState(next),
      });
    },

    toggleRole: () =>
      set((state) => ({
        currentRole:
          state.currentRole === 'owner'
            ? 'customer'
            : 'owner',
      })),

    /**
     * Updates a customer's existing booking in
     * the local Zustand state.
     *
     * Customer Active Orders still uses this
     * functionality. Database synchronization for
     * this flow can be handled separately.
     */
    updateBooking: (
      bookingId,
      updates
    ) => {
      const state = get();

      const bookings = state.bookings.map(
        (booking) => {
          if (
            booking.id !== bookingId
          ) {
            return booking;
          }

          const merged = {
            ...booking,
            ...updates,
          };

          return applyBookingValidation(
            merged,
            state.operatorSettings,
            state.bookings,
            state.menuItems,
            state.ingredients
          );
        }
      );

      const next = {
        ...state,
        bookings,
      };

      const derived =
        refreshDerivedState(next);

      set({
        bookings,
        ...derived,
      });
    },

    /**
     * Select a menu item for the current
     * customer booking.
     */
    selectMenuItem: (itemId) =>
      set((state) => ({
        selectedMenuItemIds: [
          ...state.selectedMenuItemIds,
          itemId,
        ],
      })),

    /**
     * Remove a menu item from the current
     * customer booking.
     */
    deselectMenuItem: (itemId) =>
      set((state) => ({
        selectedMenuItemIds:
          state.selectedMenuItemIds.filter(
            (id) => id !== itemId
          ),
      })),

    /**
     * Save the customer's dietary restrictions
     * in the current booking session.
     */
    setDietaryRestrictions: (
      restrictions
    ) =>
      set({
        customerDietaryRestrictions:
          restrictions,
      }),

    /**
     * Save the current customer's booking
     * information in the temporary session state.
     */
    setCustomerBookingDraft: (
      draft
    ) =>
      set({
        customerBookingDraft: draft,
      }),

    /**
     * Set the customer's selected order type.
     */
    setCustomerOrderType: (type) =>
      set({
        customerOrderType: type,
      }),

    /**
     * Clears customer-only temporary state
     * after a booking or meal-prep submission.
     */
    clearCustomerSession: () =>
      set({
        selectedMenuItemIds: [],
        customerDietaryRestrictions: [],
        customerBookingDraft: {},
        customerOrderType: 'catering',
      }),

    /**
     * Replace the current alert list.
     */
    updateAlerts: (alerts) =>
      set({
        alerts,
      }),

    /**
     * Rebuild derived menu inventory status
     * and alerts.
     */
    regenerateAlerts: () => {
      const state = get();

      set(
        refreshDerivedState(state)
      );
    },
  })
);