import { createAdminClient } from '@/lib/supabase-admin'

const MAX_MESSAGE_LENGTH = 500

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/(password|token|secret|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/\bBearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .slice(0, MAX_MESSAGE_LENGTH)
}

export async function logSystemError(source: string, error: unknown): Promise<void> {
  try {
    await createAdminClient().from('SYSTEM_LOG').insert({
      AdminID: null,
      LogType: 'error',
      Message: `[${source}] ${safeErrorMessage(error)}`.slice(0, MAX_MESSAGE_LENGTH),
      Timestamp: new Date().toISOString(),
    })
  } catch {
    // Error logging must never mask the original failure.
  }
}

export function formatUptime(timestamp: string | null, now = new Date()): string {
  if (!timestamp) return 'No deployment recorded'
  const elapsedMs = Math.max(0, now.getTime() - new Date(timestamp).getTime())
  const totalHours = Math.floor(elapsedMs / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return `${days} days ${hours} hours since last deployment`
}
