'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { AdminShell, formatDate } from '@/app/admin/admin-shell'
import { getSystemLogs, type SystemLog } from '@/app/actions/admin-actions'

function typeVariant(type: string) { return type === 'deployment' ? 'default' : type === 'backup' ? 'secondary' : 'outline' }

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  async function load() { const result = await getSystemLogs({ search, type, page }); setLogs(result.logs); setTotal(result.total) }
  useEffect(() => { load().catch(() => { setLogs([]); setTotal(0) }) }, [page, type])
  function submit(event: FormEvent) { event.preventDefault(); setPage(1); load().catch(() => undefined) }

  return <AdminShell><header className="mb-8"><p className="text-sm font-medium text-primary">Audit trail</p><h2 className="mt-2 text-3xl font-semibold">System logs</h2></header>
    <Card className="p-5"><form onSubmit={submit} className="flex flex-col gap-3 md:flex-row"><input aria-label="Search logs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages" className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm" /><select aria-label="Filter by type" value={type} onChange={(event) => { setType(event.target.value); setPage(1) }} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">All types</option><option value="deployment">Deployment</option><option value="backup">Backup</option><option value="restore">Restore</option></select><button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Filter</button></form>
      <div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className="px-3 py-3 font-medium">Timestamp</th><th className="px-3 py-3 font-medium">Type</th><th className="px-3 py-3 font-medium">Message</th><th className="px-3 py-3 font-medium">Admin</th></tr></thead><tbody>{logs.map((log) => <tr key={log.LogID} className="border-b border-border last:border-0"><td className="whitespace-nowrap px-3 py-3">{formatDate(log.Timestamp)}</td><td className="px-3 py-3"><Badge variant={typeVariant(log.LogType)}>{log.LogType}</Badge></td><td className="min-w-64 px-3 py-3">{log.Message}</td><td className="px-3 py-3 text-muted-foreground">{log.admin?.Username ?? log.admin?.Email ?? 'System'}</td></tr>)}</tbody></table>{logs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No logs found.</p>}</div>
      <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground"><span>{total} total entries</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50">Previous</button><button type="button" disabled={page * 25 >= total} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50">Next</button></div></div>
    </Card></AdminShell>
}
