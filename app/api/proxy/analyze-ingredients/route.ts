import { NextResponse } from 'next/server';

export const maxDuration = 60; // Set max duration to 60 seconds (hobby plan limit)
export const dynamic = 'force-dynamic'; // Disable static optimization

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 second timeout (slightly less than maxDuration)

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analyze-ingredients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_TOKEN}`
      },
      body: JSON.stringify(data),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in analyze-ingredients proxy:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timed out. The ingredient analysis is taking longer than expected. Please try with fewer ingredients or contact support for assistance.' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to analyze ingredients' },
      { status: 500 }
    );
  }
}
