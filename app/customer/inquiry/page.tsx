'use client';

import { DashboardLayout } from '@/app/dashboard-layout';
import { useAppState } from '@/lib/state';
import { supabase } from '@/lib/supabase';
import type {
  AllergenType,
  FulfillmentMethod,
  MealPrepFrequency,
  OrderType,
} from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { CalendarDays, UtensilsCrossed } from 'lucide-react';

type AllergyTagRow = {
  AllergyTagID: number;
  AllergenName: string;
};

const FALLBACK_ALLERGEN_OPTIONS: AllergenType[] = [
  'shellfish',
  'peanuts',
  'dairy',
  'gluten',
  'eggs',
  'soy',
];

export default function InquiryPage() {
  const router = useRouter();

  const {
    currentUser,
    customerOrderType,
    setCustomerOrderType,
    setCustomerBookingDraft,
    setDietaryRestrictions,
  } = useAppState();

  const isMealPrep = customerOrderType === 'meal_prep';

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

  const [allergenOptions, setAllergenOptions] = useState<AllergenType[]>(
    FALLBACK_ALLERGEN_OPTIONS
  );

  const [allergyTagRows, setAllergyTagRows] = useState<AllergyTagRow[]>([]);

  const [dietary, setDietary] = useState<AllergenType[]>([]);

  const [loadingAllergies, setLoadingAllergies] = useState(true);
  const [savingAllergies, setSavingAllergies] = useState(false);

  /*
   * Load the available allergy tags and the customer's
   * previously saved allergies from Supabase.
   */
  useEffect(() => {
    async function loadCustomerAllergies() {
      if (!currentUser?.id) {
        setLoadingAllergies(false);
        return;
      }

      try {
        setLoadingAllergies(true);

        // Load available allergy tags from the database.
        const {
          data: tags,
          error: tagsError,
        } = await supabase
          .from('ALLERGY_TAG')
          .select('AllergyTagID, AllergenName')
          .order('AllergyTagID');

        if (tagsError) {
          console.error('Failed to load allergy tags:', tagsError);
        } else if (tags) {
          const validTags = tags.filter((tag) =>
            FALLBACK_ALLERGEN_OPTIONS.includes(
              tag.AllergenName as AllergenType
            )
          ) as AllergyTagRow[];

          setAllergyTagRows(validTags);

          if (validTags.length > 0) {
            setAllergenOptions(
              validTags.map((tag) => tag.AllergenName as AllergenType)
            );
          }
        }

        // Load the customer's saved allergy selections.
        const customerId = Number(currentUser.id);

        const {
          data: customerAllergies,
          error: customerAllergiesError,
        } = await supabase
          .from('CUSTOMER_ALLERGY')
          .select('AllergyTagID')
          .eq('CustomerID', customerId);

        if (customerAllergiesError) {
          console.error(
            'Failed to load customer allergies:',
            customerAllergiesError
          );
          return;
        }

        if (!customerAllergies || customerAllergies.length === 0) {
          setDietary([]);
          setDietaryRestrictions([]);
          return;
        }

        // Convert AllergyTagIDs into allergen names.
        const savedAllergies = customerAllergies
            .map((customerAllergy) => {
              const tag = (tags ?? []).find(
                (item) =>
                  item.AllergyTagID === customerAllergy.AllergyTagID
              );

              return tag?.AllergenName;
            })
            .filter((allergen): allergen is AllergenType => {
              if (!allergen) return false;

              return FALLBACK_ALLERGEN_OPTIONS.some(
                (option) => option === allergen
              );
          });

        setDietary(savedAllergies);
        setDietaryRestrictions(savedAllergies);
      } catch (error) {
        console.error('Error loading customer allergies:', error);
      } finally {
        setLoadingAllergies(false);
      }
    }

    loadCustomerAllergies();
  }, [currentUser?.id, setDietaryRestrictions]);

  const switchOrderType = (type: OrderType) => {
    setCustomerOrderType(type);
  };

  const toggleAllergen = (allergen: AllergenType) => {
    setDietary((prev) =>
      prev.includes(allergen)
        ? prev.filter((a) => a !== allergen)
        : [...prev, allergen]
    );
  };

  /*
   * Save the customer's allergy selections to CUSTOMER_ALLERGY.
   */
  const saveCustomerAllergies = async () => {
    if (!currentUser?.id) {
      throw new Error('No customer is currently logged in.');
    }

    const customerId = Number(currentUser.id);

    if (!Number.isFinite(customerId)) {
      throw new Error('Invalid customer ID.');
    }

    // Remove the customer's previous allergy selections.
    const { error: deleteError } = await supabase
      .from('CUSTOMER_ALLERGY')
      .delete()
      .eq('CustomerID', customerId);

    if (deleteError) {
      throw new Error(
        `Could not clear previous allergy selections: ${deleteError.message}`
      );
    }

    // Nothing more to insert if the customer selected no allergies.
    if (dietary.length === 0) {
      return;
    }

    // Convert allergen names into AllergyTagIDs.
    const selectedRows = allergyTagRows
      .filter((tag) =>
        dietary.includes(tag.AllergenName as AllergenType)
      )
      .map((tag) => ({
        CustomerID: customerId,
        AllergyTagID: tag.AllergyTagID,
      }));

    if (selectedRows.length === 0) {
      return;
    }

    const { error: insertError } = await supabase
      .from('CUSTOMER_ALLERGY')
      .insert(selectedRows);

    if (insertError) {
      throw new Error(
        `Could not save allergy selections: ${insertError.message}`
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser?.id) {
      alert('Please log in as a customer before continuing.');
      return;
    }

    try {
      setSavingAllergies(true);

      // Save allergies to Supabase.
      await saveCustomerAllergies();

      // Keep Zustand updated for the current session.
      setDietaryRestrictions(dietary);

      if (isMealPrep) {
        setCustomerBookingDraft({
          orderType: 'meal_prep',
          eventType: mealPrepForm.planName,
          eventDate: mealPrepForm.startDate,
          eventTime: mealPrepForm.fulfillmentTime,
          venue:
            mealPrepForm.fulfillmentMethod === 'delivery'
              ? mealPrepForm.address
              : 'Pickup at kitchen',
          guestCount:
            parseInt(mealPrepForm.servingsPerCycle, 10) || 1,
          mealPrepFrequency: mealPrepForm.frequency,
          fulfillmentMethod: mealPrepForm.fulfillmentMethod,
          specialRequests: mealPrepForm.specialRequests,
        });
      } else {
        setCustomerBookingDraft({
          orderType: 'catering',
          eventType: cateringForm.eventType,
          eventDate: cateringForm.eventDate,
          eventTime: cateringForm.eventTime,
          venue: cateringForm.venue,
          guestCount:
            parseInt(cateringForm.guestCount, 10) || 1,
          specialRequests: cateringForm.specialRequests,
        });
      }

      console.log('Customer allergies saved:', dietary);

      console.log('CATERING FORM:', cateringForm);
      console.log('MEAL PREP FORM:', mealPrepForm);

      console.log(
        'DATE BEING SAVED:',
        isMealPrep
          ? mealPrepForm.startDate
          : cateringForm.eventDate
      );

      console.log('Booking draft before Browse:', {
        orderType: isMealPrep ? 'meal_prep' : 'catering',
        eventDate: isMealPrep
          ? mealPrepForm.startDate
          : cateringForm.eventDate,
        eventTime: isMealPrep
          ? mealPrepForm.fulfillmentTime
          : cateringForm.eventTime,
        venue: isMealPrep
          ? mealPrepForm.fulfillmentMethod === 'delivery'
            ? mealPrepForm.address
            : 'Pickup at kitchen'
          : cateringForm.venue,
        guestCount: isMealPrep
          ? mealPrepForm.servingsPerCycle
          : cateringForm.guestCount,
      });

      router.push('/customer/browse');
    } catch (error) {
      console.error('Failed to save customer allergies:', error);

      alert(
        error instanceof Error
          ? error.message
          : 'Could not save your dietary restrictions.'
      );
    } finally {
      setSavingAllergies(false);
    }
  };

  const inputClass =
    'w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent';

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-surface-foreground">
            {isMealPrep ? 'Start Meal Prep Plan' : 'Book Catering'}
          </h1>

          <p className="text-surface-muted-foreground mt-2">
            {isMealPrep
              ? 'Set up a recurring weekly or bi-weekly meal prep order'
              : 'Tell us about your one-time catering event'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => switchOrderType('catering')}
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
            onClick={() => switchOrderType('meal_prep')}
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

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {!isMealPrep ? (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-card-foreground">
                  Event Details
                </h2>

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Event Type *
                  </label>

                  <input
                    type="text"
                    placeholder="Wedding, Corporate Lunch, Birthday Party, etc."
                    value={cateringForm.eventType}
                    onChange={(e) =>
                      setCateringForm({
                        ...cateringForm,
                        eventType: e.target.value,
                      })
                    }
                    required
                    className={inputClass}
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      Event Date *
                    </label>

                    <input
                      type="date"
                      value={cateringForm.eventDate}
                      onChange={(e) =>
                        setCateringForm({
                          ...cateringForm,
                          eventDate: e.target.value,
                        })
                      }
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      Event Time *
                    </label>

                    <input
                      type="time"
                      value={cateringForm.eventTime}
                      onChange={(e) =>
                        setCateringForm({
                          ...cateringForm,
                          eventTime: e.target.value,
                        })
                      }
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      Number of Guests *
                    </label>

                    <input
                      type="number"
                      min="1"
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
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Venue *
                  </label>

                  <input
                    type="text"
                    placeholder="Location of your event"
                    value={cateringForm.venue}
                    onChange={(e) =>
                      setCateringForm({
                        ...cateringForm,
                        venue: e.target.value,
                      })
                    }
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Special Requests
                  </label>

                  <textarea
                    value={cateringForm.specialRequests}
                    onChange={(e) =>
                      setCateringForm({
                        ...cateringForm,
                        specialRequests: e.target.value,
                      })
                    }
                    rows={4}
                    className={inputClass}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-card-foreground">
                  Meal Prep Plan
                </h2>

                <p className="text-sm text-muted-foreground">
                  Your plan repeats on a schedule. The operator validates
                  fulfillment day capacity separately from catering events.
                </p>

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Plan Name *
                  </label>

                  <input
                    type="text"
                    placeholder="e.g. Weekly Fitness Meals, Family Lunch Prep"
                    value={mealPrepForm.planName}
                    onChange={(e) =>
                      setMealPrepForm({
                        ...mealPrepForm,
                        planName: e.target.value,
                      })
                    }
                    required
                    className={inputClass}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      First Fulfillment Date *
                    </label>

                    <input
                      type="date"
                      value={mealPrepForm.startDate}
                      onChange={(e) =>
                        setMealPrepForm({
                          ...mealPrepForm,
                          startDate: e.target.value,
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
                      value={mealPrepForm.fulfillmentTime}
                      onChange={(e) =>
                        setMealPrepForm({
                          ...mealPrepForm,
                          fulfillmentTime: e.target.value,
                        })
                      }
                      required
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      Frequency *
                    </label>

                    <select
                      value={mealPrepForm.frequency}
                      onChange={(e) =>
                        setMealPrepForm({
                          ...mealPrepForm,
                          frequency: e.target.value as MealPrepFrequency,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
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
                      value={mealPrepForm.servingsPerCycle}
                      onChange={(e) =>
                        setMealPrepForm({
                          ...mealPrepForm,
                          servingsPerCycle: e.target.value,
                        })
                      }
                      required
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Fulfillment Method *
                  </label>

                  <div className="flex gap-4">
                    {(['pickup', 'delivery'] as FulfillmentMethod[]).map(
                      (method) => (
                        <label
                          key={method}
                          className="flex items-center gap-2 cursor-pointer text-sm text-card-foreground"
                        >
                          <input
                            type="radio"
                            name="fulfillmentMethod"
                            checked={
                              mealPrepForm.fulfillmentMethod === method
                            }
                            onChange={() =>
                              setMealPrepForm({
                                ...mealPrepForm,
                                fulfillmentMethod: method,
                              })
                            }
                          />

                          <span className="capitalize">{method}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                {mealPrepForm.fulfillmentMethod === 'delivery' && (
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-2">
                      Delivery Address *
                    </label>

                    <input
                      type="text"
                      placeholder="Street, city, delivery notes"
                      value={mealPrepForm.address}
                      onChange={(e) =>
                        setMealPrepForm({
                          ...mealPrepForm,
                          address: e.target.value,
                        })
                      }
                      required
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Special Requests
                  </label>

                  <textarea
                    value={mealPrepForm.specialRequests}
                    onChange={(e) =>
                      setMealPrepForm({
                        ...mealPrepForm,
                        specialRequests: e.target.value,
                      })
                    }
                    rows={3}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* CUSTOMER ALLERGIES */}
            <div className="space-y-6 pt-6 border-t border-border">
              <div>
                <h2 className="text-lg font-bold text-card-foreground">
                  Dietary Restrictions
                </h2>

                <p className="text-sm text-muted-foreground mt-1">
                  Select any allergens you need to avoid. Your selections
                  will be saved to your customer profile.
                </p>
              </div>

              {loadingAllergies ? (
                <p className="text-sm text-muted-foreground">
                  Loading your dietary restrictions...
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {allergenOptions.map((allergen) => (
                    <label
                      key={allergen}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={dietary.includes(allergen)}
                        onChange={() => toggleAllergen(allergen)}
                        className="w-4 h-4 border-border rounded"
                      />

                      <span className="text-sm text-card-foreground capitalize">
                        {allergen.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-6 border-t border-border">
              <Button
                type="submit"
                disabled={savingAllergies || loadingAllergies}
                className="flex-1 bg-primary text-white font-medium hover:bg-brand"
              >
                {savingAllergies
                  ? 'Saving...'
                  : 'Continue to Menu Selection'}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}