'use server'

import { requireRole } from '@/app/actions/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import type { DayOfWeek } from '@/lib/types'

const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6]

type SettingsInput = {
  operatingHoursStart: string
  operatingHoursEnd: string
  maxEventsPerDay: Record<DayOfWeek, number>
  maxMealPrepOrdersPerDay: Record<DayOfWeek, number>
  maxGuestsPerEvent: number
}

type SettingRow = {
  SettingID: number
  DayOfWeek: string
  OperatingStartTime: string | null
  OperatingEndTime: string | null
  MaxCateringEventsPerDay: number | null
  MaxMealPrepOrdersPerDay: number | null
  MaxGuestCountPerEvent: number | null
}

export type SettingsActionResult =
  | { ok: true; rowsUpdated: number; rows?: SettingRow[] }
  | { ok: false; error: string }

function isIntegerAtLeast(value: number, minimum: number) {
  return Number.isInteger(value) && value >= minimum
}

function validateSettings(input: SettingsInput): string | null {
  if (!input.operatingHoursStart || !input.operatingHoursEnd) {
    return 'Operating start and end times are required.'
  }

  if (input.operatingHoursStart >= input.operatingHoursEnd) {
    return 'Operating start time must be before the end time.'
  }

  for (const day of ALL_DAYS) {
    if (!isIntegerAtLeast(input.maxEventsPerDay[day], 0)) {
      return 'Daily catering limits must be whole numbers of at least 0.'
    }
    if (!isIntegerAtLeast(input.maxMealPrepOrdersPerDay[day], 0)) {
      return 'Daily meal-prep limits must be whole numbers of at least 0.'
    }
  }

  if (!isIntegerAtLeast(input.maxGuestsPerEvent, 1) || input.maxGuestsPerEvent > 1000) {
    return 'Max guests per event must be a whole number from 1 to 1000.'
  }

  return null
}

async function getOwnerSettings(operatorId: number): Promise<SettingsActionResult> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('OPERATOR_SETTINGS')
    .select(
      'SettingID, DayOfWeek, OperatingStartTime, OperatingEndTime, MaxCateringEventsPerDay, MaxMealPrepOrdersPerDay, MaxGuestCountPerEvent'
    )
    .eq('OperatorID', operatorId)
    .order('SettingID')

  if (error) return { ok: false, error: error.message || 'Could not load operating rules.' }
  return { ok: true, rowsUpdated: 0, rows: (data ?? []) as SettingRow[] }
}

export async function loadOperatingRules(): Promise<SettingsActionResult> {
  const owner = await requireRole('owner')
  if (!owner) return { ok: false, error: 'Owner access required.' }
  return getOwnerSettings(Number(owner.id))
}

export async function saveOperatingRules(input: SettingsInput): Promise<SettingsActionResult> {
  const owner = await requireRole('owner')
  if (!owner) return { ok: false, error: 'Owner access required.' }

  const validationError = validateSettings(input)
  if (validationError) return { ok: false, error: validationError }

  const operatorId = Number(owner.id)
  const admin = createAdminClient()
  const { data: existingRows, error: fetchError } = await admin
    .from('OPERATOR_SETTINGS')
    .select('SettingID, DayOfWeek')
    .eq('OperatorID', operatorId)
    .order('SettingID')

  if (fetchError) return { ok: false, error: fetchError.message || 'Could not load operating rules.' }
  if (!existingRows || existingRows.length !== 7) {
    return { ok: false, error: 'Could not update all 7 operating rules rows.' }
  }

  for (const row of existingRows as Array<{ SettingID: number; DayOfWeek: string }>) {
    const day = Number(row.DayOfWeek) as DayOfWeek
    const { data, error } = await admin
      .from('OPERATOR_SETTINGS')
      .update({
        OperatingStartTime: input.operatingHoursStart,
        OperatingEndTime: input.operatingHoursEnd,
        MaxCateringEventsPerDay: input.maxEventsPerDay[day] ?? 0,
        MaxMealPrepOrdersPerDay: input.maxMealPrepOrdersPerDay[day] ?? 0,
        MaxGuestCountPerEvent: input.maxGuestsPerEvent,
      })
      .eq('SettingID', row.SettingID)
      .eq('OperatorID', operatorId)
      .select('SettingID')

    if (error) return { ok: false, error: error.message || 'Could not save operating rules.' }
    if (!data || data.length === 0) {
      return { ok: false, error: `Operating rule row ${row.SettingID} was not updated.` }
    }
  }

  return { ok: true, rowsUpdated: existingRows.length }
}

