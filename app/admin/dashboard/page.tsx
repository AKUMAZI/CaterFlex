'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { AdminShell, formatDate } from '@/app/admin/admin-shell'
import { getSystemHealth, type SystemHealth } from '@/app/actions/admin-actions'

export default function AdminDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null)

  useEffect(() => {
    getSystemHealth().then(setHealth).catch(() => setHealth({ database: 'disconnected', lastDeployment: null, lastBackup: null }))
  }, [])

  return <AdminShell>
    <header className="mb-8"><p className="text-sm font-medium text-primary">System control</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Dashboard</h2><p className="mt-2 text-muted-foreground">Monitor deployment and backup activity without exposing business data.</p></header>
    <section aria-label="System health" className="grid gap-4 md:grid-cols-3">
      <Card className="p-5"><p className="text-sm text-muted-foreground">Database</p><p className="mt-2 text-2xl font-semibold capitalize">{health?.database ?? 'Checking…'}</p></Card>
      <Card className="p-5"><p className="text-sm text-muted-foreground">Last deployment</p><p className="mt-2 text-lg font-semibold">{formatDate(health?.lastDeployment ?? null)}</p></Card>
      <Card className="p-5"><p className="text-sm text-muted-foreground">Last backup</p><p className="mt-2 text-lg font-semibold">{formatDate(health?.lastBackup ?? null)}</p></Card>
    </section>
    <div className="mt-8 grid gap-4 md:grid-cols-3">
      {[['/admin/deploy', 'Deploy', 'Trigger a Vercel deployment hook.'], ['/admin/backups', 'Backups', 'Run simulated backup and restore controls.'], ['/admin/logs', 'Logs', 'Review system activity newest first.']].map(([href, title, description]) => <Link key={href} href={href}><Card className="h-full p-5 transition-colors hover:border-primary"><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{description}</p></Card></Link>)}
    </div>
  </AdminShell>
}
