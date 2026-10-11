import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireRole, createAdminClient } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/app/actions/auth', () => ({ requireRole }))
vi.mock('@/lib/supabase-admin', () => ({ createAdminClient }))

import { saveOperatingRules } from './settings-actions'

const validInput = {
  operatingHoursStart: '08:00',
  operatingHoursEnd: '18:00',
  maxEventsPerDay: { 0: 0, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
  maxMealPrepOrdersPerDay: { 0: 0, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 },
  maxGuestsPerEvent: 100,
} as const

function builder(result: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    update: vi.fn(() => chain),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

function rows() {
  return Array.from({ length: 7 }, (_, index) => ({
    SettingID: index + 1,
    DayOfWeek: String(index),
  }))
}

describe('saveOperatingRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireRole.mockResolvedValue({ id: '42', role: 'owner' })
  })

  it('updates all seven owner rows successfully', async () => {
    const client = {
      from: vi.fn()
        .mockReturnValueOnce(builder({ data: rows(), error: null }))
        .mockImplementation(() => builder({ data: [{ SettingID: 1 }], error: null })),
    }
    createAdminClient.mockReturnValue(client)

    const result = await saveOperatingRules(validInput)

    expect(result).toEqual({ ok: true, rowsUpdated: 7 })
    expect(client.from).toHaveBeenCalledTimes(8)
    expect(client.from.mock.results[1].value.eq).toHaveBeenCalledWith('OperatorID', 42)
  })

  it('rejects invalid operating hours before writing', async () => {
    createAdminClient.mockReturnValue({ from: vi.fn() })

    const result = await saveOperatingRules({ ...validInput, operatingHoursStart: '19:00' })

    expect(result).toEqual({ ok: false, error: 'Operating start time must be before the end time.' })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('reports when an update returns zero rows', async () => {
    const client = {
      from: vi.fn()
        .mockReturnValueOnce(builder({ data: rows(), error: null }))
        .mockReturnValueOnce(builder({ data: [], error: null })),
    }
    createAdminClient.mockReturnValue(client)

    const result = await saveOperatingRules(validInput)

    expect(result).toEqual({ ok: false, error: 'Operating rule row 1 was not updated.' })
  })
})
