'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { AdminShell, formatDate } from '@/app/admin/admin-shell'
import { getSystemLogs, initiateBackup, restoreBackup, type SystemLog } from '@/app/actions/admin-actions'

export default function AdminBackupsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  async function load() { const result = await getSystemLogs({ type: 'backup' }); setLogs(result.logs) }
  useEffect(() => { load().catch(() => undefined) }, [])
  async function backup() { setPending(true); setMessage(''); await initiateBackup(); setMessage('Simulated backup recorded.'); await load().catch(() => undefined); setPending(false) }
  async function restore(logId: number) { if (!window.confirm('Type RESTORE in the next prompt to confirm this simulated restore.')) return; const confirmation = window.prompt('Type RESTORE to confirm.'); if (confirmation !== 'RESTORE') return; setPending(true); await restoreBackup(logId); setMessage('Simulated restore recorded.'); setPending(false) }
  return <AdminShell><header className="mb-8"><p className="text-sm font-medium text-primary">Recovery controls</p><h2 className="mt-2 text-3xl font-semibold">Backups</h2></header><p role="note" className="rounded-md border border-border bg-muted p-4 text-sm">Backup and restore are simulated in this build. Production backups are managed by Supabase.</p><Card className="mt-6 p-6"><button type="button" disabled={pending} onClick={backup} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{pending ? 'Working…' : 'Initiate backup'}</button>{message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}</Card><Card className="mt-6 p-6"><h3 className="font-semibold">Backup history</h3><div className="mt-4 flex flex-col gap-3">{logs.map((log) => <div key={log.LogID} className="flex items-center justify-between border-b border-border pb-3 last:border-0"><div><p className="text-sm">{log.Message}</p><p className="text-xs text-muted-foreground">{formatDate(log.Timestamp)}</p></div><button type="button" disabled={pending} onClick={() => restore(log.LogID)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">Restore</button></div>)}{logs.length === 0 && <p className="text-sm text-muted-foreground">No backups recorded.</p>}</div></Card></AdminShell>
}
