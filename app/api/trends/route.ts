import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fetch from your existing trends API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://143.198.46.229:5000';
    const response = await fetch(`${apiUrl}/trends/google`);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      data: data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch trends',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
