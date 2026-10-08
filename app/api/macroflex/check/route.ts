import { checkSufficiencyWithAllocations } from '@/lib/macroflex'
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

    const fulfillmentDate = searchParams.get('fulfillmentDate') ?? new Date().toISOString().slice(0, 10)
    const prepStartDate = searchParams.get('prepStartDate') ?? fulfillmentDate
    const excludeType = searchParams.get('excludeType')
    const excludeId = searchParams.get('excludeId')
    if ((excludeType === null) !== (excludeId === null)) {
      return NextResponse.json({ error: 'excludeType and excludeId must be provided together' }, { status: 400 })
    }
    let excludeRef: { type: 'booking' | 'meal_prep'; id: number } | undefined
    if (excludeType !== null && excludeId !== null) {
      const parsedId = Number(excludeId)
      if (!['booking', 'meal_prep'].includes(excludeType) || !Number.isInteger(parsedId) || parsedId <= 0) {
        return NextResponse.json({ error: 'excludeType and excludeId must be valid' }, { status: 400 })
      }
      excludeRef = { type: excludeType as 'booking' | 'meal_prep', id: parsedId }
    }
    const result = await checkSufficiencyWithAllocations(
      parseInt(menuItemId, 10),
      quantity ? parseInt(quantity, 10) : 1,
      prepStartDate,
      fulfillmentDate,
      excludeRef,
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
