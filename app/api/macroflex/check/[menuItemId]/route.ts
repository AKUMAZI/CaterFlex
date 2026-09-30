import { checkSufficiency } from '@/lib/macroflex'
import { NextRequest, NextResponse } from 'next/server'

interface RouteContext {
  params: Promise<{ menuItemId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { menuItemId } = await context.params
    const parsedMenuItemId = Number(menuItemId)
    const quantity = Number(new URL(request.url).searchParams.get('quantity') ?? '1')

    if (!Number.isInteger(parsedMenuItemId) || parsedMenuItemId < 1) {
      return NextResponse.json({ error: 'menuItemId must be a positive integer' }, { status: 400 })
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'quantity must be greater than zero' }, { status: 400 })
    }

    return NextResponse.json(await checkSufficiency(parsedMenuItemId, quantity))
  } catch (error) {
    console.error('[API] Sufficiency check error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'

