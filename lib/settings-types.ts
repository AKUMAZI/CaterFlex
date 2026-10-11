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

export type { DayOfWeek }

export type OperatorSettingRow = SettingRow & { OperatorID: number | null }

export type SettingsState = {
  operatingDays: DayOfWeek[]
  operatingHoursStart: string
  operatingHoursEnd: string
  maxEventsPerDay: Record<DayOfWeek, number>
  maxMealPrepOrdersPerDay: Record<DayOfWeek, number>
  maxGuestsPerEvent: number
}

export const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6]

export const DEFAULT_SETTINGS: SettingsState = {
  operatingDays: [1, 2, 3, 4, 5, 6],
  operatingHoursStart: '08:00',
  operatingHoursEnd: '18:00',
  maxEventsPerDay: { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3 },
  maxMealPrepOrdersPerDay: { 0: 0, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 3 },
  maxGuestsPerEvent: 100,
}

export function normalizeTime(value: string | null): string {
  return value ? value.slice(0, 5) : ''
}

export function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export function isOpenDay(day: DayOfWeek, settings: SettingsState) {
  return settings.operatingDays.includes(day)
}

export function settingsForDay(settings: SettingsState, day: DayOfWeek) {
  return { catering: settings.maxEventsPerDay[day], mealPrep: settings.maxMealPrepOrdersPerDay[day] }
}

export function formatSettingsError(error: unknown) {
  return error instanceof Error ? error.message : 'Could not update operating rules.'
}

export function toDay(value: string | number) {
  return Number(value) as DayOfWeek
}

export function hasValidDay(day: DayOfWeek) {
  return ALL_DAYS.includes(day)
}

export function emptySettings(): SettingsState {
  return { ...DEFAULT_SETTINGS, maxEventsPerDay: { ...DEFAULT_SETTINGS.maxEventsPerDay }, maxMealPrepOrdersPerDay: { ...DEFAULT_SETTINGS.maxMealPrepOrdersPerDay }, operatingDays: [] }
}

export function settingRowsToState(rows: SettingRow[]): SettingsState {
  const settings = emptySettings()
  for (const row of rows) {
    const day = toDay(row.DayOfWeek)
    if (!hasValidDay(day)) continue
    settings.maxEventsPerDay[day] = row.MaxCateringEventsPerDay ?? 0
    settings.maxMealPrepOrdersPerDay[day] = row.MaxMealPrepOrdersPerDay ?? 0
    if ((row.MaxCateringEventsPerDay ?? 0) > 0) settings.operatingDays.push(day)
    if (row.OperatingStartTime) settings.operatingHoursStart = normalizeTime(row.OperatingStartTime)
    if (row.OperatingEndTime) settings.operatingHoursEnd = normalizeTime(row.OperatingEndTime)
    if (row.MaxGuestCountPerEvent !== null) settings.maxGuestsPerEvent = row.MaxGuestCountPerEvent
  }
  settings.operatingDays.sort()
  return settings
}

export function settingsPayload(settings: SettingsState): SettingsInput {
  return { operatingHoursStart: settings.operatingHoursStart, operatingHoursEnd: settings.operatingHoursEnd, maxEventsPerDay: settings.maxEventsPerDay, maxMealPrepOrdersPerDay: settings.maxMealPrepOrdersPerDay, maxGuestsPerEvent: settings.maxGuestsPerEvent }
}

export function isValidSettingsInput(input: SettingsInput) {
  return Boolean(input.operatingHoursStart && input.operatingHoursEnd && input.operatingHoursStart < input.operatingHoursEnd && Number.isInteger(input.maxGuestsPerEvent) && input.maxGuestsPerEvent >= 1)
}

export function cloneSettings(settings: SettingsState): SettingsState {
  return { ...settings, operatingDays: [...settings.operatingDays], maxEventsPerDay: { ...settings.maxEventsPerDay }, maxMealPrepOrdersPerDay: { ...settings.maxMealPrepOrdersPerDay } }
}

export function settingDayLabel(day: DayOfWeek) { return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] }

export function settingRowsUpdated(rows: SettingRow[]) { return rows.length }

export function hasAllSettingRows(rows: SettingRow[]) { return rows.length === 7 }

export function settingValue(value: number | null | undefined, fallback = 0) { return value ?? fallback }

export function settingsEqual(a: SettingsState, b: SettingsState) { return JSON.stringify(a) === JSON.stringify(b) }

export function getMaxGuests(settings: SettingsState) { return settings.maxGuestsPerEvent }

export function withMaxGuests(settings: SettingsState, maxGuestsPerEvent: number): SettingsState { return { ...settings, maxGuestsPerEvent } }

export function withOperatingDays(settings: SettingsState, operatingDays: DayOfWeek[]): SettingsState { return { ...settings, operatingDays: [...operatingDays].sort() } }

export function withLimits(settings: SettingsState, maxEventsPerDay: Record<DayOfWeek, number>, maxMealPrepOrdersPerDay: Record<DayOfWeek, number>): SettingsState { return { ...settings, maxEventsPerDay, maxMealPrepOrdersPerDay } }

export function withHours(settings: SettingsState, operatingHoursStart: string, operatingHoursEnd: string): SettingsState { return { ...settings, operatingHoursStart, operatingHoursEnd } }

export function settingRows(rows: SettingRow[] | undefined) { return rows ?? [] }

export function isSuccessful(result: SettingsActionResult): result is Extract<SettingsActionResult, { ok: true }> { return result.ok }

export function isFailed(result: SettingsActionResult): result is Extract<SettingsActionResult, { ok: false }> { return !result.ok }

export function maxGuestCountOrDefault(value: number | null, fallback = 100) { return value ?? fallback }

export function dayIsOpen(settings: SettingsState, day: DayOfWeek) { return settings.maxEventsPerDay[day] > 0 }

export function allDays() { return [...ALL_DAYS] }

export function defaultSettings() { return cloneSettings(DEFAULT_SETTINGS) }

export function emptyRows() { return [] as SettingRow[] }

export function operatorSettingRows(rows: SettingRow[]) { return rows as OperatorSettingRow[] }

export function settingsInputFromState(settings: SettingsState) { return settingsPayload(settings) }

export function rowDay(row: SettingRow) { return toDay(row.DayOfWeek) }

export function rowGuestLimit(row: SettingRow) { return maxGuestCountOrDefault(row.MaxGuestCountPerEvent) }

export function rowOperatingHours(row: SettingRow) { return { start: normalizeTime(row.OperatingStartTime), end: normalizeTime(row.OperatingEndTime) } }

export function rowLimits(row: SettingRow) { return { catering: settingValue(row.MaxCateringEventsPerDay), mealPrep: settingValue(row.MaxMealPrepOrdersPerDay) } }

export function isArchivedSettingRow(_row: SettingRow) { return false }

export function settingsVersion() { return 1 }

export function validGuestLimit(value: number) { return Number.isInteger(value) && value >= 1 && value <= 1000 }

export function validTimeRange(start: string, end: string) { return Boolean(start && end && start < end) }

export function validDay(day: number): day is DayOfWeek { return ALL_DAYS.includes(day as DayOfWeek) }

export function settingRowKey(row: SettingRow) { return row.SettingID }

export function settingRowDay(row: SettingRow) { return Number(row.DayOfWeek) }

export function settingsSummary(settings: SettingsState) { return `${settings.operatingHoursStart}-${settings.operatingHoursEnd};${settings.maxGuestsPerEvent}` }
