import { getScrapBasedSuggestions } from '@/lib/macroflex'
import { NextResponse } from 'next/server'

interface RouteContext {
  params: Promise<{ menuItemId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { menuItemId } = await context.params
    const parsedMenuItemId = Number(menuItemId)

    if (!Number.isInteger(parsedMenuItemId) || parsedMenuItemId < 1) {
      return NextResponse.json({ error: 'menuItemId must be a positive integer' }, { status: 400 })
    }

    return NextResponse.json(await getScrapBasedSuggestions(parsedMenuItemId))
  } catch (error) {
    console.error('[API] Scrap-based suggestions error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'

