'use server'

import { requireRole } from '@/app/actions/auth'
import { createAdminClient } from '@/lib/supabase-admin'

export async function getCustomerAllergies() {
  const customer = await requireRole('customer')
  if (!customer) return { ok: false as const, error: 'Customer access required.', allergyTagIds: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('CUSTOMER_ALLERGY')
    .select('AllergyTagID')
    .eq('CustomerID', Number(customer.id))

  if (error) return { ok: false as const, error: error.message, allergyTagIds: [] }
  return { ok: true as const, allergyTagIds: (data ?? []).map((row) => row.AllergyTagID) }
}

export async function setCustomerAllergies(allergyTagIds: number[]) {
  const customer = await requireRole('customer')
  if (!customer) return { ok: false as const, error: 'Customer access required.' }

  const customerId = Number(customer.id)
  const admin = createAdminClient()

  const { error: deleteError } = await admin
    .from('CUSTOMER_ALLERGY')
    .delete()
    .eq('CustomerID', customerId)

  if (deleteError) {
    return { ok: false as const, error: `Could not clear previous allergy selections: ${deleteError.message}` }
  }

  if (allergyTagIds.length === 0) return { ok: true as const }

  const { error: insertError } = await admin
    .from('CUSTOMER_ALLERGY')
    .insert(allergyTagIds.map((AllergyTagID) => ({ CustomerID: customerId, AllergyTagID })))

  if (insertError) {
    return { ok: false as const, error: `Could not save allergy selections: ${insertError.message}` }
  }

  return { ok: true as const }
}

export async function getAllergiesForBookingCheck(customerId: number) {
  const owner = await requireRole('owner')
  if (!owner) return { ok: false as const, error: 'Owner access required.', allergyTagIds: [] }

  // Owners review bookings belonging to other customers, so this deliberate exception
  // accepts the booking's CustomerID instead of deriving it from the owner's session.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('CUSTOMER_ALLERGY')
    .select('AllergyTagID')
    .eq('CustomerID', customerId)

  if (error) return { ok: false as const, error: error.message, allergyTagIds: [] }
  return { ok: true as const, allergyTagIds: (data ?? []).map((row) => row.AllergyTagID) }
}
