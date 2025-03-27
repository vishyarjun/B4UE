import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analyze-ingredients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_TOKEN}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in analyze-ingredients proxy:', error);
    return NextResponse.json(
      { error: 'Failed to analyze ingredients' },
      { status: 500 }
    );
  }
}
