import { NextResponse } from 'next/server'
import { getSuggestions } from '@/lib/macroflex'

export async function GET(_request: Request, { params }: { params: Promise<{ menuItemId: string }> }) {
  const { menuItemId } = await params
  const id = Number(menuItemId)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid menu item id' }, { status: 400 })
  try {
    const { suggestions } = await getSuggestions(id)
    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ error: 'Unable to generate alternate suggestions' }, { status: 500 })
  }
}
