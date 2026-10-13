import { describe, expect, it, vi } from 'vitest'
import { formatUptime, logSystemError } from './system-log'

const insert = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/lib/supabase-admin', () => ({ createAdminClient: () => ({ from: () => ({ insert }) }) }))

describe('system logging', () => {
  it('formats uptime from the last deployment', () => {
    expect(formatUptime('2026-10-10T00:00:00.000Z', new Date('2026-10-13T04:00:00.000Z'))).toBe('3 days 4 hours since last deployment')
    expect(formatUptime(null)).toBe('No deployment recorded')
  })

  it('truncates messages and never throws', async () => {
    await logSystemError('test', new Error('x'.repeat(600)))
    expect(insert.mock.calls[0][0].Message).toHaveLength(500)
    insert.mockRejectedValueOnce(new Error('database unavailable'))
    await expect(logSystemError('test', 'failure')).resolves.toBeUndefined()
  })
})
