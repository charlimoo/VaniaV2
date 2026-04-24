import { NextRequest, NextResponse } from "next/server"

import { API_BASE_URL } from "@/lib/api"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const backendCallbackUrl = new URL(`${API_BASE_URL}/api/billing/zibal/callback/`)

  searchParams.forEach((value, key) => {
    backendCallbackUrl.searchParams.append(key, value)
  })

  return NextResponse.redirect(backendCallbackUrl)
}
