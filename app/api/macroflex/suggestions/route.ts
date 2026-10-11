import { requireRole } from '@/app/actions/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { getScrapBasedSuggestions } from '@/lib/macroflex'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const owner = await requireRole('owner')
  if (!owner) return NextResponse.json({ error: 'Owner access required.' }, { status: 403 })
  try {
    const { searchParams } = new URL(request.url)
    const menuItemId = searchParams.get('menuItemId')

    if (!menuItemId) {
      return NextResponse.json(
        { error: 'menuItemId query parameter is required' },
        { status: 400 }
      )
    }

    const result = await getScrapBasedSuggestions(parseInt(menuItemId, 10), Number(owner.id), createAdminClient())

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] Scrap-based suggestions error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
