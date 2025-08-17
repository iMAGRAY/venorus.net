import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database/db-connection'

export async function GET() {
  try {
    const result = await executeQuery(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'product_variants' 
      ORDER BY ordinal_position;
    `, []);
    
    return NextResponse.json({
      success: true,
      columns: result.rows
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to check DB structure',
        details: (error as any).message 
      },
      { status: 500 }
    );
  }
}