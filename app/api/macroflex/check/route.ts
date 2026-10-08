import { requireRole } from '@/app/actions/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { checkOrderSufficiencyWithAllocations, checkSufficiencyWithAllocations } from '@/lib/macroflex'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const owner = await requireRole('owner')
  if (!owner) {
    return NextResponse.json({ error: 'Owner access required.' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const menuItemId = searchParams.get('menuItemId')
    const menuItemIdsParam = searchParams.get('menuItemIds')
    const quantity = searchParams.get('quantity')

    if (menuItemId && menuItemIdsParam !== null) {
      return NextResponse.json({ error: 'menuItemId and menuItemIds cannot be provided together' }, { status: 400 })
    }
    if (!menuItemId && menuItemIdsParam === null) {
      return NextResponse.json(
        { error: 'menuItemId or menuItemIds query parameter is required' },
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

    if (menuItemIdsParam !== null) {
      const menuItemIds = menuItemIdsParam.split(',').map((value) => Number(value.trim()))
      const servingsParam = searchParams.get('servings')
      const servings = servingsParam === null ? 1 : Number(servingsParam)
      if (!menuItemIds.length || menuItemIds.some((id) => !Number.isInteger(id) || id <= 0) || !Number.isInteger(servings) || servings <= 0) {
        return NextResponse.json({ error: 'menuItemIds must be comma-separated positive integers and servings must be a positive integer' }, { status: 400 })
      }
      const result = await checkOrderSufficiencyWithAllocations(
        menuItemIds.map((id) => ({ menuItemId: id })),
        servings,
        fulfillmentDate,
        excludeRef,
        createAdminClient(),
      )
      return NextResponse.json(result)
    }

    const result = await checkSufficiencyWithAllocations(
      parseInt(menuItemId ?? '', 10),
      quantity ? parseInt(quantity, 10) : 1,
      prepStartDate,
      fulfillmentDate,
      excludeRef,
      createAdminClient(),
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
