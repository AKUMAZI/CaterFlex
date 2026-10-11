import type { DayOfWeek } from '@/lib/types'

export type SettingsInput = {
  operatingHoursStart: string
  operatingHoursEnd: string
  maxEventsPerDay: Record<DayOfWeek, number>
  maxMealPrepOrdersPerDay: Record<DayOfWeek, number>
  maxGuestsPerEvent: number
}

export type SettingRow = {
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

export type OperatorSettingRow = SettingRow & { OperatorID: number | null }

export type SettingsState = {
  operatingDays: DayOfWeek[]
  operatingHoursStart: string
  operatingHoursEnd: string
  maxEventsPerDay: Record<DayOfWeek, number>
  maxMealPrepOrdersPerDay: Record<DayOfWeek, number>
  maxGuestsPerEvent: number
}
