import { NextResponse } from 'next/server'
import { getOverstock } from '@/lib/macroflex'

export async function GET() {
  try {
    const { overstock } = await getOverstock()
    return NextResponse.json({ overstock })
  } catch {
    return NextResponse.json({ error: 'Unable to check over-purchased ingredients' }, { status: 500 })
  }
}
