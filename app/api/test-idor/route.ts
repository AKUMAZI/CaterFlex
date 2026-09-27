import { updateBookingStatus } from '@/app/actions/booking-actions'
import { NextResponse } from 'next/server'

export async function POST() {
  const result = await updateBookingStatus(13, 'confirmed')
  return NextResponse.json(result)
}
