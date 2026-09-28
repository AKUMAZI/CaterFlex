'use client';

import { CustomerShell } from '@/app/customer/customer-shell';
import { useAppState } from '@/lib/state';
import type {
  AllergenType,
  Booking,
  FulfillmentMethod,
  MealPrepFrequency,
  OrderType,
} from '@/lib/types';
import {
  getDateAvailability,
  findNextAvailableDate,
} from '@/lib/rules/bookingValidation';
import { supabase } from '@/lib/supabase';

import { useRouter } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { useEffect, useMemo, useState } from 'react';

import {
  CalendarDays,
  UtensilsCrossed,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

const ALLERGEN_OPTIONS: AllergenType[] = [
  'shellfish',
  'peanuts',
  'dairy',
  'gluten',
  'eggs',
  'soy',
  'tree_nuts',
  'other',
];

function formatDateLabel(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(
    undefined,
    {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }
  );
}

export default function InquiryPage() {
  const router = useRouter();

  const {
    bookings,
    operatorSettings,
    customerOrderType,
    loadOperatorSettings,
    setCustomerOrderType,
    setCustomerBookingDraft,
    setDietaryRestrictions,
  } = useAppState();

  const isMealPrep = customerOrderType === 'meal_prep';

  useEffect(() => {
    loadOperatorSettings();
  }, [loadOperatorSettings]);

  /*
   * ============================================================
   * DATABASE BOOKINGS
   * ============================================================
   *
   * BOOKING is the source of truth for catering capacity.
   *
   * BOOKING does not have an OrderType column.
   * Therefore, BOOKING records are treated as catering bookings.
   */

  const [databaseBookings, setDatabaseBookings] = useState<Booking[]>(
    []
  );

  const [loadingAvailability, setLoadingAvailability] =
    useState(false);

  const loadDatabaseBookings = async () => {
    setLoadingAvailability(true);

    const { data, error } = await supabase
      .from('BOOKING')
      .select(
        `
        BookingID,
        CustomerID,
        OperatorID,
        EventDate,
        EventTime,
        Venue,
        GuestCount,
        Status
        `
      )
      .eq('OperatorID', 2);

    if (error) {
      console.error(
        'BOOKING AVAILABILITY FETCH ERROR:',
        error
      );

      setDatabaseBookings([]);
      setLoadingAvailability(false);

      return;
    }

    type DatabaseBooking = {
      BookingID: number;
      CustomerID: number | null;
      OperatorID: number | null;
      EventDate: string;
      EventTime: string;
      Venue: string | null;
      GuestCount: number | null;
      Status: string | null;
    };

    const formattedBookings: Booking[] = (
      (data ?? []) as DatabaseBooking[]
    ).map((booking): Booking => ({
      id: String(booking.BookingID),

      customerId: String(
        booking.CustomerID ?? ''
      ),

      customerName: '',

      customerEmail: '',

      orderType: 'catering',

      eventDate: String(
        booking.EventDate ?? ''
      ),

      eventTime: String(
        booking.EventTime ?? ''
      ),

      eventType: '',

      venue: String(
        booking.Venue ?? ''
      ),

      guestCount: Number(
        booking.GuestCount ?? 0
      ),

      status:
        booking.Status === 'confirmed'
          ? 'confirmed'
          : booking.Status === 'rejected'
            ? 'rejected'
            : booking.Status === 'completed'
              ? 'completed'
              : 'pending',

      selectedMenuItemIds: [],

      dietaryRestrictions: [],

      eventProfileId: '',

      totalCost: 0,

      paymentsReceived: 0,

      createdAt: '',

      specialRequests: '',

      validationPassed: true,

      ruleViolations: [],
    }));

    setDatabaseBookings(formattedBookings);

    setLoadingAvailability(false);
  };

  /*
   * Load current database bookings when the page opens.
   */

  useEffect(() => {
    loadDatabaseBookings();
  }, []);

  /*
   * ============================================================
   * FORM STATE
   * ============================================================
   */

  const [cateringForm, setCateringForm] = useState({
    eventType: '',
    eventDate: '',
    eventTime: '12:00',
    venue: '',
    guestCount: '',
    specialRequests: '',
  });

  const [mealPrepForm, setMealPrepForm] = useState({
    planName: '',
    startDate: '',
    fulfillmentTime: '10:00',
    frequency: 'weekly' as MealPrepFrequency,
    fulfillmentMethod: 'pickup' as FulfillmentMethod,
    servingsPerCycle: '',
    address: '',
    specialRequests: '',
  });

  const [dietary, setDietary] = useState<AllergenType[]>(
    []
  );

  const [guestCountError, setGuestCountError] =
    useState('');

  /*
   * ============================================================
   * ACTIVE DATE
   * ============================================================
   */

  const activeDate = isMealPrep
    ? mealPrepForm.startDate
    : cateringForm.eventDate;

  /*
   * ============================================================
   * BOOKINGS USED FOR AVAILABILITY
   * ============================================================
   *
   * Catering:
   *   Uses real Supabase BOOKING records.
   *
   * Meal prep:
   *   Uses existing application booking data because
   *   MEAL_PREP_ORDER currently has no fulfillment date.
   */

  const availabilityBookings = isMealPrep
    ? bookings
    : databaseBookings;

  /*
   * ============================================================
   * DATE AVAILABILITY
   * ============================================================
   */

  const dateAvailability = useMemo(() => {
    if (!activeDate) {
      return null;
    }

    return getDateAvailability(
      activeDate,
      customerOrderType,
      operatorSettings,
      availabilityBookings
    );
  }, [
    activeDate,
    customerOrderType,
    operatorSettings,
    availabilityBookings,
  ]);

  /*
   * ============================================================
   * SUGGESTED DATE
   * ============================================================
   */

  const suggestedDate = useMemo(() => {
    if (
      !activeDate ||
      !dateAvailability ||
      dateAvailability.available
    ) {
      return null;
    }

    /*
     * IMPORTANT:
     * findNextAvailableDate currently accepts only
     * four arguments.
     */

    return findNextAvailableDate(
      activeDate,
      customerOrderType,
      operatorSettings,
      availabilityBookings
    );
  }, [
    activeDate,
    dateAvailability,
    customerOrderType,
    operatorSettings,
    availabilityBookings,
  ]);

  /*
   * ============================================================
   * APPLY SUGGESTED DATE
   * ============================================================
   */

  const applySuggestedDate = () => {
    if (!suggestedDate) {
      return;
    }

    if (isMealPrep) {
      setMealPrepForm((prev) => ({
        ...prev,
        startDate: suggestedDate,
      }));
    } else {
      setCateringForm((prev) => ({
        ...prev,
        eventDate: suggestedDate,
      }));
    }

    setGuestCountError('');
  };

  /*
   * ============================================================
   * ORDER TYPE
   * ============================================================
   */

  const switchOrderType = (type: OrderType) => {
    setCustomerOrderType(type);
    setGuestCountError('');
  };

  /*
   * ============================================================
   * ALLERGENS
   * ============================================================
   */

  const toggleAllergen = (
    allergen: AllergenType
  ) => {
    setDietary((prev) =>
      prev.includes(allergen)
        ? prev.filter((a) => a !== allergen)
        : [...prev, allergen]
    );
  };

  /*
   * ============================================================
   * SUBMIT
   * ============================================================
   */

  const handleSubmit = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    /*
     * Do not allow submission if the selected date
     * is unavailable.
     */

    if (
      dateAvailability &&
      !dateAvailability.available
    ) {
      return;
    }

    /*
     * Guest count validation.
     */

    if (!isMealPrep && cateringForm.guestCount) {
      const guestCount = Number(
        cateringForm.guestCount
      );

      const maxGuests =
        operatorSettings.maxGuestsPerEvent;

      if (guestCount > maxGuests) {
        setGuestCountError(
          `Guest count (${guestCount}) exceeds the maximum allowed guests per event (${maxGuests}).`
        );

        return;
      }

      setGuestCountError('');
    }

    setDietaryRestrictions(dietary);

    /*
     * ==========================================================
     * MEAL PREP
     * ==========================================================
     */

    if (isMealPrep) {
      setCustomerBookingDraft({
        orderType: 'meal_prep',

        eventType:
          mealPrepForm.planName,

        eventDate:
          mealPrepForm.startDate,

        eventTime:
          mealPrepForm.fulfillmentTime,

        venue:
          mealPrepForm.fulfillmentMethod ===
          'delivery'
            ? mealPrepForm.address
            : 'Pickup at kitchen',

        guestCount:
          parseInt(
            mealPrepForm.servingsPerCycle,
            10
          ) || 1,

        mealPrepFrequency:
          mealPrepForm.frequency,

        fulfillmentMethod:
          mealPrepForm.fulfillmentMethod,

        specialRequests:
          mealPrepForm.specialRequests,
      });

      router.push(
        '/customer/meal-prep-preview'
      );

      return;
    }

    /*
     * ==========================================================
     * CATERING
     * ==========================================================
     */

    setCustomerBookingDraft({
      orderType: 'catering',

      eventType:
        cateringForm.eventType,

      eventDate:
        cateringForm.eventDate,

      eventTime:
        cateringForm.eventTime,

      venue:
        cateringForm.venue,

      guestCount:
        parseInt(
          cateringForm.guestCount,
          10
        ) || 1,

      specialRequests:
        cateringForm.specialRequests,
    });

    router.push(
      '/customer/browse'
    );
  };

  /*
   * ============================================================
   * INPUT STYLE
   * ============================================================
   */

  const inputClass =
    'w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent';

  /*
   * ============================================================
   * AVAILABILITY BANNER
   * ============================================================
   */

  const availabilityBanner =
    dateAvailability &&
    !dateAvailability.available && (
      <div className="flex flex-col gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-700" />

          <div className="space-y-1">
            <p className="text-sm font-medium text-yellow-900">
              This date is not available.
            </p>

            <p className="text-sm text-yellow-800">
              {dateAvailability.reason ??
                'The operator cannot accept bookings for this date.'}
            </p>
          </div>
        </div>

        {suggestedDate && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-white/60 px-3 py-2">
            <p className="flex items-center gap-2 text-sm text-yellow-900">
              <Sparkles className="h-4 w-4" />

              Nearest open date:

              <span className="font-semibold">
                {formatDateLabel(
                  suggestedDate
                )}
              </span>
            </p>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={applySuggestedDate}
            >
              Use this date
            </Button>
          </div>
        )}
      </div>
    );

  /*
   * ============================================================
   * PAGE
   * ============================================================
   */

  return (
    <CustomerShell>
      <div className="max-w-3xl mx-auto space-y-8">

        {/* PAGE HEADER */}

        <div>
          <h1 className="font-heading text-3xl font-bold text-surface-foreground">
            {isMealPrep
              ? 'Start Meal Prep Plan'
              : 'Book Catering'}
          </h1>

          <p className="text-surface-muted-foreground mt-2">
            {isMealPrep
              ? 'Set up a recurring weekly or bi-weekly meal prep order'
              : 'Tell us about your one-time catering event'}
          </p>
        </div>

        {/* ORDER TYPE */}

        <div className="grid grid-cols-2 gap-4">

          <button
            type="button"
            onClick={() =>
              switchOrderType('catering')
            }
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              !isMealPrep
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <CalendarDays className="w-6 h-6 text-primary mb-2" />

            <p className="font-heading font-bold text-card-foreground">
              Catering Event
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              Weddings, corporate events, parties
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              switchOrderType('meal_prep')
            }
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              isMealPrep
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <UtensilsCrossed className="w-6 h-6 text-secondary mb-2" />

            <p className="font-heading font-bold text-card-foreground">
              Meal Prep Plan
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              Recurring weekly or bi-weekly meals
            </p>
          </button>

        </div>

        {/* FORM */}

        <Card className="p-8">
          <form
            onSubmit={handleSubmit}
            className="space-y-8"
          >

            {/* ================================================= */}
            {/* CATERING */}
            {/* ================================================= */}

            {!isMealPrep ? (
              <div className="space-y-6">

                <h2 className="text-lg font-bold text-card-foreground">
                  Event Details
                </h2>

                {/* EVENT TYPE */}

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Event Type *
                  </label>

                  <input
                    type="text"
                    placeholder="Wedding, Corporate Lunch, Birthday Party, etc."
                    value={
                      cateringForm.eventType
                    }
                    onChange={(e) =>
                      setCateringForm({
                        ...cateringForm,
                        eventType:
                          e.target.value,
                      })
                    }
                    required
                    className={inputClass}
                  />
                </div>

                {/* DATE / TIME / GUESTS */}

                <div className="grid md:grid-cols-3 gap-6">

                  {/* DATE */}

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      Event Date *
                    </label>

                    <input
                      type="date"
                      value={
                        cateringForm.eventDate
                      }
                      onChange={(e) =>
                        setCateringForm({
                          ...cateringForm,
                          eventDate:
                            e.target.value,
                        })
                      }
                      required
                      className={inputClass}
                    />
                  </div>

                  {/* TIME */}

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      Event Time *
                    </label>

                    <input
                      type="time"
                      value={
                        cateringForm.eventTime
                      }
                      onChange={(e) =>
                        setCateringForm({
                          ...cateringForm,
                          eventTime:
                            e.target.value,
                        })
                      }
                      required
                      className={inputClass}
                    />
                  </div>

                  {/* GUEST COUNT */}

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      Number of Guests *
                    </label>

                    <input
                      type="number"
                      min="1"
                      max={operatorSettings.maxGuestsPerEvent}
                      value={cateringForm.guestCount}
                      onChange={(e) =>
                        setCateringForm({
                          ...cateringForm,
                          guestCount: e.target.value,
                        })
                      }
                      required
                      className={inputClass}
                    />

                    <p className="mt-1 text-xs text-muted-foreground">
                      Maximum: {operatorSettings.maxGuestsPerEvent} guests
                    </p>

                    {guestCountError && (
                      <p className="mt-1 text-xs text-red-600">
                        {guestCountError}
                      </p>
                    )}
                  </div>

                </div>

                {/* AVAILABILITY */}

                {loadingAvailability &&
                  cateringForm.eventDate && (
                    <p className="text-sm text-muted-foreground">
                      Checking booking availability...
                    </p>
                  )}

                {availabilityBanner}

                {/* VENUE */}

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Venue *
                  </label>

                  <input
                    type="text"
                    placeholder="Location of your event"
                    value={
                      cateringForm.venue
                    }
                    onChange={(e) =>
                      setCateringForm({
                        ...cateringForm,
                        venue:
                          e.target.value,
                      })
                    }
                    required
                    className={inputClass}
                  />
                </div>

                {/* SPECIAL REQUESTS */}

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Special Requests
                  </label>

                  <textarea
                    value={
                      cateringForm.specialRequests
                    }
                    onChange={(e) =>
                      setCateringForm({
                        ...cateringForm,
                        specialRequests:
                          e.target.value,
                      })
                    }
                    rows={4}
                    className={inputClass}
                  />
                </div>

              </div>
            ) : (

              /* ================================================= */
              /* MEAL PREP */
              /* ================================================= */

              <div className="space-y-6">

                <h2 className="text-lg font-bold text-card-foreground">
                  Meal Prep Plan
                </h2>

                <p className="text-sm text-muted-foreground">
                  Your plan repeats on a schedule.
                  The operator validates fulfillment
                  day capacity separately from catering
                  events.
                </p>

                {/* PLAN NAME */}

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Plan Name *
                  </label>

                  <input
                    type="text"
                    placeholder="e.g. Weekly Fitness Meals, Family Lunch Prep"
                    value={
                      mealPrepForm.planName
                    }
                    onChange={(e) =>
                      setMealPrepForm({
                        ...mealPrepForm,
                        planName:
                          e.target.value,
                      })
                    }
                    required
                    className={inputClass}
                  />
                </div>

                {/* DATE / TIME */}

                <div className="grid md:grid-cols-2 gap-6">

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      First Fulfillment Date *
                    </label>

                    <input
                      type="date"
                      value={
                        mealPrepForm.startDate
                      }
                      onChange={(e) =>
                        setMealPrepForm({
                          ...mealPrepForm,
                          startDate:
                            e.target.value,
                        })
                      }
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      Pickup / Delivery Time *
                    </label>

                    <input
                      type="time"
                      value={
                        mealPrepForm.fulfillmentTime
                      }
                      onChange={(e) =>
                        setMealPrepForm({
                          ...mealPrepForm,
                          fulfillmentTime:
                            e.target.value,
                        })
                      }
                      required
                      className={inputClass}
                    />
                  </div>

                </div>

                {/* AVAILABILITY */}

                {availabilityBanner}

                {/* FREQUENCY / SERVINGS */}

                <div className="grid md:grid-cols-2 gap-6">

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      Frequency *
                    </label>

                    <select
                      value={
                        mealPrepForm.frequency
                      }
                      onChange={(e) =>
                        setMealPrepForm({
                          ...mealPrepForm,
                          frequency:
                            e.target.value as MealPrepFrequency,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="weekly">
                        Weekly
                      </option>

                      <option value="biweekly">
                        Every 2 weeks
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      Servings per Cycle *
                    </label>

                    <input
                      type="number"
                      min="1"
                      placeholder="Meals per fulfillment"
                      value={
                        mealPrepForm.servingsPerCycle
                      }
                      onChange={(e) =>
                        setMealPrepForm({
                          ...mealPrepForm,
                          servingsPerCycle:
                            e.target.value,
                        })
                      }
                      required
                      className={inputClass}
                    />
                  </div>

                </div>

                {/* FULFILLMENT METHOD */}

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Fulfillment Method *
                  </label>

                  <div className="flex gap-4">

                    {(
                      [
                        'pickup',
                        'delivery',
                      ] as FulfillmentMethod[]
                    ).map((method) => (
                      <label
                        key={method}
                        className="flex items-center gap-2 cursor-pointer text-sm text-card-foreground"
                      >
                        <input
                          type="radio"
                          name="fulfillmentMethod"
                          checked={
                            mealPrepForm.fulfillmentMethod ===
                            method
                          }
                          onChange={() =>
                            setMealPrepForm({
                              ...mealPrepForm,
                              fulfillmentMethod:
                                method,
                            })
                          }
                        />

                        <span className="capitalize">
                          {method}
                        </span>
                      </label>
                    ))}

                  </div>
                </div>

                {/* DELIVERY ADDRESS */}

                {mealPrepForm.fulfillmentMethod ===
                  'delivery' && (
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      Delivery Address *
                    </label>

                    <input
                      type="text"
                      placeholder="Street, city, delivery notes"
                      value={
                        mealPrepForm.address
                      }
                      onChange={(e) =>
                        setMealPrepForm({
                          ...mealPrepForm,
                          address:
                            e.target.value,
                        })
                      }
                      required
                      className={inputClass}
                    />
                  </div>
                )}

                {/* SPECIAL REQUESTS */}

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Special Requests
                  </label>

                  <textarea
                    value={
                      mealPrepForm.specialRequests
                    }
                    onChange={(e) =>
                      setMealPrepForm({
                        ...mealPrepForm,
                        specialRequests:
                          e.target.value,
                      })
                    }
                    rows={3}
                    className={inputClass}
                  />
                </div>

              </div>
            )}

            {/* ================================================= */}
            {/* DIETARY RESTRICTIONS */}
            {/* ================================================= */}

            <div className="space-y-6 pt-6 border-t border-border">

              <h2 className="text-lg font-bold text-card-foreground">
                Dietary Restrictions
              </h2>

              <div className="grid md:grid-cols-2 gap-4">

                {ALLERGEN_OPTIONS.map(
                  (allergen) => (
                    <label
                      key={allergen}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={dietary.includes(
                          allergen
                        )}
                        onChange={() =>
                          toggleAllergen(
                            allergen
                          )
                        }
                        className="w-4 h-4 border-border rounded"
                      />

                      <span className="text-sm text-card-foreground capitalize">
                        {allergen.replace(
                          '_',
                          ' '
                        )}
                      </span>
                    </label>
                  )
                )}

              </div>
            </div>

            {/* ================================================= */}
            {/* BUTTONS */}
            {/* ================================================= */}

            <div className="flex gap-4 pt-6 border-t border-border">

              <Button
                type="submit"
                disabled={
                  Boolean(
                    dateAvailability &&
                      !dateAvailability.available
                  ) ||
                  loadingAvailability ||
                  Boolean(
                    guestCountError
                  )
                }
                className="flex-1 bg-primary text-white font-medium hover:bg-brand disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Menu Selection
              </Button>

              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() =>
                  router.back()
                }
              >
                Cancel
              </Button>

            </div>

          </form>
        </Card>
      </div>
    </CustomerShell>
  );
}