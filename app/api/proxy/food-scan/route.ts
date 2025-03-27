import { NextResponse } from 'next/server';

export const maxDuration = 60; // Set max duration to 60 seconds (hobby plan limit)
export const dynamic = 'force-dynamic'; // Disable static optimization

export async function POST(request: Request) {
  const formData = await request.formData();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 second timeout (slightly less than maxDuration)

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/food-scan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN}`
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in food-scan proxy:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timed out. The food scan is taking longer than expected. Please try with a smaller image or contact support for assistance.' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to process food image' },
      { status: 500 }
    );
  }
}
