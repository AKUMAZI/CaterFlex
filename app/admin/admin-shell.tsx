'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode } from 'react'
import { BarChart3, CloudCog, DatabaseBackup, FileText, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const links = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/deploy', label: 'Deploy', icon: CloudCog },
  { href: '/admin/backups', label: 'Backups', icon: DatabaseBackup },
  { href: '/admin/logs', label: 'Logs', icon: FileText },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <div className="min-h-screen bg-surface text-surface-foreground md:flex">
      <aside className="w-full border-b border-border bg-card md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex h-full flex-col gap-8 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">CaterFlex</p>
            <h1 className="mt-2 text-xl font-semibold">Administration</h1>
          </div>
          <nav aria-label="Administrator navigation" className="flex flex-wrap gap-2 md:flex-col">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <Icon data-icon="inline-start" />
                {label}
              </Link>
            ))}
          </nav>
          <button type="button" onClick={logout} className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut data-icon="inline-start" />
            Log Out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-5 md:p-8">{children}</main>
    </div>
  )
}

export function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Never'
}
