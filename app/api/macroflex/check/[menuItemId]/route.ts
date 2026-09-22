import { NextResponse } from 'next/server'
import { getMenuItemCheck } from '@/lib/macroflex'

export async function GET(_request: Request, { params }: { params: Promise<{ menuItemId: string }> }) {
  const { menuItemId } = await params
  const id = Number(menuItemId)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid menu item id' }, { status: 400 })
  try {
    const result = await getMenuItemCheck(id)
    return NextResponse.json({ sufficient: result.sufficient, shortfalls: result.shortfalls })
  } catch {
    return NextResponse.json({ error: 'Unable to check menu item stock' }, { status: 500 })
  }
}
