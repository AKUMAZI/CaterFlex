import { checkSufficiency } from '@/lib/macroflex'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const menuItemId = searchParams.get('menuItemId')
    const quantity = searchParams.get('quantity')

    if (!menuItemId) {
      return NextResponse.json(
        { error: 'menuItemId query parameter is required' },
        { status: 400 }
      )
    }

    const result = await checkSufficiency(
      parseInt(menuItemId, 10),
      quantity ? parseInt(quantity, 10) : 1
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] Sufficiency check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
