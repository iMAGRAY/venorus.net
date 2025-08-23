import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-connection"

export async function GET() {
  try {

    // Test database connectivity

    // Try a simple query

    const result = await executeQuery("SELECT COUNT(*) as count FROM products")
    const productCount = result.rows[0].count

    return NextResponse.json({
      success: true,
      productCount: productCount,
      message: "Database test successful",
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}