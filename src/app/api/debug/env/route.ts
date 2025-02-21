import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    hasBirdeyeKey: !!process.env.BIRDEYE_API_KEY,
    keyPrefix: process.env.BIRDEYE_API_KEY ? process.env.BIRDEYE_API_KEY.substring(0, 5) : null,
    envKeys: Object.keys(process.env).filter(key => !key.includes('SECRET') && !key.includes('KEY')),
  })
}
