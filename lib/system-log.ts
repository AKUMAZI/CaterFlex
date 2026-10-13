import { createAdminClient } from '@/lib/supabase-admin'

export function formatUptime(since: string | null, now = new Date()): string {
  if (!since) return 'No deployment recorded'
  const elapsed = Math.max(0, now.getTime() - new Date(since).getTime())
  const days = Math.floor(elapsed / 86400000)
  const hours = Math.floor((elapsed % 86400000) / 3600000)
  return `${days} day${days === 1 ? '' : 's'} ${hours} hour${hours === 1 ? '' : 's'} since last deployment`
}

export async function logSystemError(source: string, error: unknown): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error)
    await createAdminClient().from('SYSTEM_LOG').insert({
      AdminID: null,
      LogType: 'error',
      Message: `[${source}] ${message}`.slice(0, 500),
      Timestamp: new Date().toISOString(),
    })
  } catch {
    // Error logging must never mask the original failure.
  }
}

export function formatUptimeForTest(since: string | null, now = new Date()) {
  return formatUptime(since, now)
}
