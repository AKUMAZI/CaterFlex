'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { AdminShell, formatDate } from '@/app/admin/admin-shell'
import { getSystemLogs, triggerDeploy, type SystemLog } from '@/app/actions/admin-actions'

export default function AdminDeployPage() {
  const [history, setHistory] = useState<SystemLog[]>([])
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  async function load() { const result = await getSystemLogs({ type: 'deployment' }); setHistory(result.logs) }
  useEffect(() => { load().catch(() => undefined) }, [])
  async function deploy() { if (!window.confirm('Trigger a new deployment?')) return; setPending(true); setMessage(''); const result = await triggerDeploy(); setMessage(result.ok ? 'Deployment hook triggered.' : result.error ?? 'Deployment failed.'); await load().catch(() => undefined); setPending(false) }
  return <AdminShell><header className="mb-8"><p className="text-sm font-medium text-primary">Release management</p><h2 className="mt-2 text-3xl font-semibold">Deploy</h2><p className="mt-2 text-muted-foreground">Trigger the configured Vercel deploy hook and review its history.</p></header><Card className="p-6"><button type="button" disabled={pending} onClick={deploy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{pending ? 'Triggering…' : 'Trigger deployment'}</button>{message && <p role="status" className="mt-4 rounded-md border border-border bg-muted p-3 text-sm">{message}</p>}</Card><Card className="mt-6 p-6"><h3 className="font-semibold">Deployment history</h3><div className="mt-4 flex flex-col gap-3">{history.map((log) => <div key={log.LogID} className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 md:flex-row md:items-center md:justify-between"><span className="text-sm">{log.Message}</span><span className="flex items-center gap-3 text-xs text-muted-foreground"><Badge variant="outline">deployment</Badge>{formatDate(log.Timestamp)}</span></div>)}{history.length === 0 && <p className="text-sm text-muted-foreground">No deployment events recorded.</p>}</div></Card></AdminShell>
}
