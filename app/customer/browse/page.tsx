'use client';

import { CustomerShell } from '@/app/customer/customer-shell';
import { useAppState } from '@/lib/state';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  checkAllergenConflict,
  getUniqueConflictingAllergens,
} from '@/lib/rules/allergenFiltering';
import type { MenuItem } from '@/lib/types';

export default function BrowsePage() {
  const router = useRouter();

  const {
    currentUser,
    selectedMenuItemIds,
    customerDietaryRestrictions,
    setDietaryRestrictions,
    selectMenuItem,
    deselectMenuItem,
    customerBookingDraft,
    clearCustomerSession,
  } = useAppState();

  const [dbMenuItems, setDbMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [showAllergenConfirm, setShowAllergenConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBookingSuccess, setShowBookingSuccess] = useState(false);

  /*
   * Load menu items from Supabase.
   */
  useEffect(() => {
    const loadMenuItems = async () => {
      try {
        setLoadingMenu(true);

        // Get menu items
        const { data: menuData, error: menuError } = await supabase
          .from('MENU_ITEM')
          .select(`
            MenuItemID,
            ItemName,
            Category,
            Price,
            PrepTimeDays,
            Description
          `)
          .order('MenuItemID');

        if (menuError) {
          console.error('MENU_ITEM loading error:', menuError);
          alert(`Failed to load menu items: ${menuError.message}`);
          return;
        }

        // Get menu item ↔ allergy relationships
        const { data: allergyRelations, error: allergyRelationError } =
          await supabase
            .from('MENU_ITEM_ALLERGY')
            .select(`
              MenuItemID,
              AllergyTagID
            `);

        if (allergyRelationError) {
          console.error(
            'MENU_ITEM_ALLERGY loading error:',
            allergyRelationError
          );

          alert(
            `Failed to load menu allergen information: ${allergyRelationError.message}`
          );

          return;
        }

        // Get allergy tag names
        const { data: allergyTags, error: allergyTagError } =
          await supabase
            .from('ALLERGY_TAG')
            .select(`
              AllergyTagID,
              AllergenName
            `);

        if (allergyTagError) {
          console.error(
            'ALLERGY_TAG loading error:',
            allergyTagError
          );

          alert(
            `Failed to load allergen information: ${allergyTagError.message}`
          );

          return;
        }

        // Convert database menu items into the application's MenuItem format
        const formattedItems: MenuItem[] = (menuData ?? []).map((item) => {
          const itemAllergyRelations = (allergyRelations ?? []).filter(
            (relation) => relation.MenuItemID === item.MenuItemID
          );

          const itemAllergyNames = itemAllergyRelations
            .map((relation) => {
              const allergyTag = (allergyTags ?? []).find(
                (tag) => tag.AllergyTagID === relation.AllergyTagID
              );

              return allergyTag?.AllergenName;
            })
            .filter((name): name is string => Boolean(name));

          return {
            id: String(item.MenuItemID),
            name: item.ItemName,
            description: item.Description ?? '',
            category: item.Category ?? '',
            price: Number(item.Price ?? 0),
            prepTimeDays: Number(item.PrepTimeDays ?? 0),
            allergyTags: itemAllergyNames as MenuItem['allergyTags'],

            // These are not currently stored in MENU_ITEM,
            // so keep the existing application defaults.
            macros: {
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
            },

            requiredIngredients: [],
            inventoryStatus: 'available',
          };
        });

        console.log('Loaded menu items:', formattedItems);

        setDbMenuItems(formattedItems);
      } catch (error) {
        console.error('Unexpected menu loading error:', error);
        alert('Something went wrong while loading the menu.');
      } finally {
        // Always stop the loading state
        setLoadingMenu(false);
      }
    };

    loadMenuItems();
  }, []);

  /*
   * Load the customer's saved allergies from Supabase.
   */
  useEffect(() => {
    const loadCustomerAllergies = async () => {
      if (!currentUser?.id) {
        setDietaryRestrictions([]);
        return;
      }

      const customerId = Number(currentUser.id);

      if (Number.isNaN(customerId)) {
        setDietaryRestrictions([]);
        return;
      }

      // Get the customer's saved allergy relationships
      const {
        data: customerAllergies,
        error: customerAllergyError,
      } = await supabase
        .from('CUSTOMER_ALLERGY')
        .select('AllergyTagID')
        .eq('CustomerID', customerId);

      if (customerAllergyError) {
        console.error(
          'Customer allergy loading error:',
          customerAllergyError
        );

        return;
      }

      const allergyTagIds = (customerAllergies ?? []).map(
        (item) => item.AllergyTagID
      );

      // Customer has no saved allergies
      if (allergyTagIds.length === 0) {
        setDietaryRestrictions([]);
        return;
      }

      // Get the actual allergen names
      const {
        data: allergyTags,
        error: allergyTagError,
      } = await supabase
        .from('ALLERGY_TAG')
        .select('AllergyTagID, AllergenName')
        .in('AllergyTagID', allergyTagIds);

      if (allergyTagError) {
        console.error(
          'Allergy tag loading error:',
          allergyTagError
        );

        return;
      }

      const allergies = (allergyTags ?? [])
        .map(
          (tag) =>
            tag.AllergenName as MenuItem['allergyTags'][number]
        )
        .filter(Boolean);

      console.log('Loaded customer allergies:', allergies);

      setDietaryRestrictions(allergies);
    };

    loadCustomerAllergies();
  }, [currentUser?.id, setDietaryRestrictions]);

  /*
   * Get the currently selected menu items.
   */
  const selectedItems = dbMenuItems.filter((item) =>
    selectedMenuItemIds.includes(item.id)
  );

  /*
   * Check selected items against the customer's allergies.
   */
  const conflictingAllergens = getUniqueConflictingAllergens(
    selectedItems,
    customerDietaryRestrictions
  );

  const hasSelectionConflicts = conflictingAllergens.length > 0;

  /*
   * Submit the booking to Supabase.
   */
  const finalizeSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const guestCount = parseInt(
        String(customerBookingDraft.guestCount || '1'),
        10
      );

      if (!currentUser?.id) {
        alert(
          'Unable to identify your customer account. Please log in again.'
        );

        setIsSubmitting(false);
        return;
      }

      const customerId = Number(currentUser.id);

      if (Number.isNaN(customerId)) {
        alert('Invalid customer account. Please log in again.');

        setIsSubmitting(false);
        return;
      }

      // CaterFlex currently uses one operator.
      const operatorId = 2;

      // Make sure the selected menu items actually exist in Supabase.
      const validMenuItemIds = selectedMenuItemIds.filter(
        (menuItemId) =>
          dbMenuItems.some((item) => item.id === menuItemId)
      );

      if (validMenuItemIds.length === 0) {
        alert('Please select at least one valid menu item.');

        setIsSubmitting(false);
        return;
      }

      /*
       * Create BOOKING
       */
      const { data: booking, error: bookingError } =
        await supabase
          .from('BOOKING')
          .insert({
            CustomerID: customerId,
            OperatorID: operatorId,
            EventDate: String(
              customerBookingDraft.eventDate ?? ''
            ),
            EventTime: String(
              customerBookingDraft.eventTime ?? ''
            ),
            Venue: String(
              customerBookingDraft.venue ?? ''
            ),
            GuestCount: guestCount,
            Status: 'pending',
          })
          .select('BookingID')
          .single();

      if (bookingError || !booking) {
        console.error(
          'BOOKING INSERT ERROR:',
          bookingError
        );

        alert(
          `Booking failed: ${
            bookingError?.message ??
            'Unable to retrieve the booking ID.'
          }`
        );

        setIsSubmitting(false);
        return;
      }

      /*
       * Create BOOKING_ITEM records
       */
      const bookingItems = validMenuItemIds.map(
        (menuItemId) => ({
          BookingID: booking.BookingID,
          MenuItemID: Number(menuItemId),
          Quantity: 1,
        })
      );

      const { error: bookingItemsError } =
        await supabase
          .from('BOOKING_ITEM')
          .insert(bookingItems);

      if (bookingItemsError) {
        console.error(
          'Booking item insert error:',
          bookingItemsError
        );

        // Remove the booking if its items failed to save.
        await supabase
          .from('BOOKING')
          .delete()
          .eq('BookingID', booking.BookingID);

        alert(
          'Failed to save the selected menu items. Please try again.'
        );

        setIsSubmitting(false);
        return;
      }

      setShowBookingSuccess(true);
    } catch (err) {
      console.error(
        'Unexpected booking error:',
        err
      );

      alert(
        'An unexpected error occurred while submitting your booking.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /*
   * Handles the Submit Booking button.
   */
  const handleSubmit = () => {
    if (selectedMenuItemIds.length === 0) {
      alert('Please select at least one menu item.');
      return;
    }

    if (hasSelectionConflicts) {
      setShowAllergenConfirm(true);
      return;
    }

    finalizeSubmit();
  };

  return (
    <CustomerShell>
      <div className="grid lg:grid-cols-3 gap-8">

        {/* MENU ITEMS */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="font-heading text-3xl font-bold text-surface-foreground">
              Menu Items
            </h1>

            <p className="text-surface-muted-foreground mt-2">
              Select items for your event
            </p>
          </div>

          {loadingMenu ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Loading menu items...
              </p>
            </Card>
          ) : dbMenuItems.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No menu items are currently available.
              </p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {dbMenuItems.map((item) => {
                const isSelected =
                  selectedMenuItemIds.includes(item.id);

                const itemConflicts =
                  checkAllergenConflict(
                    item,
                    customerDietaryRestrictions
                  );

                const hasAllergyConflict =
                  itemConflicts.length > 0;

                return (
                  <Card
                    key={item.id}
                    className={`p-6 cursor-pointer transition-all border-2 ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() =>
                      isSelected
                        ? deselectMenuItem(item.id)
                        : selectMenuItem(item.id)
                    }
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-card-foreground flex-1">
                        {item.name}
                      </h3>

                      {isSelected && (
                        <Check className="w-5 h-5 text-primary ml-2" />
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-4">
                      {item.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">
                        ${item.price}
                      </span>
                    </div>

                    {/* ALLERGEN CONFLICT */}
                    {hasAllergyConflict && (
                      <div className="mt-3 p-2 bg-red-50 rounded border border-red-200 flex gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />

                        <p className="text-xs text-red-700">
                          Conflicts with your declared{' '}
                          {itemConflicts.length === 1
                            ? 'allergy'
                            : 'allergies'}
                          :{' '}
                          {itemConflicts
                            .map((tag) =>
                              tag.replace('_', ' ')
                            )
                            .join(', ')}
                        </p>
                      </div>
                    )}

                    {/* MENU ITEM ALLERGEN TAGS */}
                    {item.allergyTags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {item.allergyTags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded"
                          >
                            {tag.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* BOOKING SUMMARY */}
        <div>
          <Card className="sticky top-24 p-6">
            <h2 className="text-lg font-bold text-card-foreground">
              Booking Summary
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {selectedMenuItemIds.length} menu items selected.
            </p>

            <div className="space-y-6 mb-8">

              {/* SELECTED ITEMS */}
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Items Selected
                </p>

                <p className="text-3xl font-bold text-primary">
                  {selectedMenuItemIds.length}
                </p>
              </div>

              {/* DIETARY RESTRICTIONS */}
              {customerDietaryRestrictions.length > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs font-semibold text-card-foreground mb-2">
                    Your Dietary Restrictions
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {customerDietaryRestrictions.map(
                      (tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded"
                        >
                          {tag.replace('_', ' ')}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* ALLERGEN CONFLICT */}
              {hasSelectionConflicts && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />

                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-1">
                      Allergen Conflict:
                    </p>

                    <p className="text-xs text-red-700">
                      Your selection contains{' '}
                      {conflictingAllergens
                        .map((tag) =>
                          tag.replace('_', ' ')
                        )
                        .join(', ')}
                      , which you declared as a restriction.
                      You will be asked to confirm before submitting.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={
                selectedMenuItemIds.length === 0 ||
                loadingMenu ||
                isSubmitting
              }
              className="w-full text-white font-medium hover:bg-brand bg-primary"
            >
              {isSubmitting
                ? 'Submitting...'
                : 'Submit Booking'}
            </Button>
          </Card>
        </div>
      </div>

      {/* ALLERGEN CONFIRMATION MODAL */}
      {showAllergenConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md p-6 border-2 border-red-200">

            <div className="flex gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />

              <div>
                <h3 className="font-heading text-lg font-bold text-card-foreground">
                  Allergen Conflict
                </h3>

                <p className="text-sm text-muted-foreground mt-1">
                  Your selection includes items with declared allergens:{' '}
                  <span className="font-semibold text-red-700">
                    {conflictingAllergens
                      .map((tag) =>
                        tag.replace('_', ' ')
                      )
                      .join(', ')}
                  </span>
                  .
                  <br />
                  <br />
                  Are you sure you want to submit this booking?
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setShowAllergenConfirm(false)
                }
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => {
                  setShowAllergenConfirm(false);
                  finalizeSubmit();
                }}
                disabled={isSubmitting}
              >
                Submit Anyway
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* BOOKING SUCCESS MODAL */}
      {showBookingSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md p-6 border-2 border-green-200">

            <div className="flex gap-3 mb-4">
              <div>
                <h3 className="font-heading text-lg font-bold text-card-foreground">
                  Booking Submitted
                </h3>

                <p className="text-sm text-muted-foreground mt-1">
                  Your booking has been successfully submitted.
                  <br />
                  <br />
                  The business owner will review your booking and confirm the details.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => {
                  setShowBookingSuccess(false);
                  clearCustomerSession();
                  router.push('/customer/inquiry');
                }}
              >
                Continue
              </Button>
            </div>
          </Card>
        </div>
      )}
    </CustomerShell>
  );
}