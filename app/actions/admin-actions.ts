'use server'

import { getSupabaseServer } from '@/lib/auth-server'
import { createAdminClient } from '@/lib/supabase-admin'

const PAGE_SIZE = 25

type LogFilters = {
  type?: string
  from?: string
  to?: string
  search?: string
  page?: number
}

async function getAdminContext() {
  const session = await requireAdmin()
  const admin = createAdminClient()
  const email = session.user.email
  const { data } = email
    ? await admin.from('ADMIN').select('AdminID').eq('Email', email).maybeSingle()
    : { data: null }
  return { admin, adminId: data?.AdminID ?? null, email }
}

export async function requireAdmin() {
  const supabase = await getSupabaseServer()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.user?.app_metadata?.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  return session
}

export async function getSystemLogs(filters: LogFilters = {}) {
  const { admin } = await getAdminContext()
  const page = Math.max(1, filters.page ?? 1)
  let query = admin
    .from('SYSTEM_LOG')
    .select('LogID, AdminID, LogType, Message, Timestamp', { count: 'exact' })
    .order('Timestamp', { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filters.type) query = query.eq('LogType', filters.type)
  if (filters.from) query = query.gte('Timestamp', filters.from)
  if (filters.to) query = query.lte('Timestamp', `${filters.to}T23:59:59`)
  if (filters.search) query = query.ilike('Message', `%${filters.search}%`)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const adminIds = [...new Set((data ?? []).map((log) => log.AdminID).filter(Boolean))]
  const { data: admins } = adminIds.length
    ? await admin.from('ADMIN').select('AdminID, Username, Email').in('AdminID', adminIds)
    : { data: [] }
  const adminMap = new Map((admins ?? []).map((item) => [item.AdminID, item]))

  return {
    logs: (data ?? []).map((log) => ({
      ...log,
      admin: log.AdminID ? adminMap.get(log.AdminID) ?? null : null,
    })),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  }
}

async function getLatestLog(admin: ReturnType<typeof createAdminClient>, type: string) {
  const { data } = await admin
    .from('SYSTEM_LOG')
    .select('Timestamp')
    .eq('LogType', type)
    .order('Timestamp', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  return data?.Timestamp ?? null
}

export async function getSystemHealth() {
  const { admin } = await getAdminContext()
  const { error } = await admin.from('SYSTEM_LOG').select('LogID', { count: 'exact', head: true })
  return {
    database: error ? 'disconnected' : 'connected',
    lastDeployment: await getLatestLog(admin, 'deployment'),
    lastBackup: await getLatestLog(admin, 'backup'),
  }
}

async function writeLog(type: string, message: string) {
  const { admin, adminId } = await getAdminContext()
  const { error } = await admin.from('SYSTEM_LOG').insert({
    AdminID: adminId,
    LogType: type,
    Message: message,
    Timestamp: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function triggerDeploy() {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL
  if (!hook) return { ok: false, error: 'Deploy hook not configured.' }

  await requireAdmin()
  try {
    const response = await fetch(hook, { method: 'POST', cache: 'no-store' })
    const message = response.ok
      ? `Deploy hook triggered successfully (${response.status}).`
      : `Deploy hook failed with status ${response.status}.`
    await writeLog('deployment', message)
    return { ok: response.ok, error: response.ok ? undefined : message }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown deploy error.'
    await writeLog('deployment', `Deploy hook error: ${message}`)
    return { ok: false, error: message }
  }
}

// Real backups are Supabase-managed. Exporting data through the admin would violate FR-12.6.
export async function initiateBackup() {
  await requireAdmin()
  await new Promise((resolve) => setTimeout(resolve, 2000))
  await writeLog('backup', '[SIMULATED] Backup initiated.')
  return { ok: true }
}

// Real backups are Supabase-managed. Exporting data through the admin would violate FR-12.6.
export async function restoreBackup(logId: number) {
  await requireAdmin()
  await new Promise((resolve) => setTimeout(resolve, 2000))
  await writeLog('restore', `[SIMULATED] Restore requested for log ${logId}.`)
  return { ok: true }
}

export type SystemLog = Awaited<ReturnType<typeof getSystemLogs>>['logs'][number]
export type SystemHealth = Awaited<ReturnType<typeof getSystemHealth>>

