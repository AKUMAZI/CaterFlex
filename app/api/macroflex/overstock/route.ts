import { checkOverPurchase } from '@/lib/macroflex'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const operatorId = searchParams.get('operatorId')

    const result = await checkOverPurchase(
      operatorId ? parseInt(operatorId, 10) : undefined
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] Over-purchase check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
