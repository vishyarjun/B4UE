import { NextResponse } from 'next/server';

export const maxDuration = 60; // Set max duration to 60 seconds (hobby plan limit)
export const dynamic = 'force-dynamic'; // Disable static optimization

export async function POST(request: Request) {
  const formData = await request.formData();
  
  try {
    console.log('Image scan proxy: Starting request to external API');
    console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
    console.log('Token present:', !!process.env.API_TOKEN);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 second timeout (slightly less than maxDuration)

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/image-scan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN}`
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Image scan proxy: External API error', {
        status: response.status,
        statusText: response.statusText,
        responseBody: errorText
      });
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    console.log('Image scan proxy: Successfully processed request');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Image scan proxy: Detailed error:', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
      hasToken: !!process.env.API_TOKEN
    });

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timed out. The image processing is taking longer than expected. Please try with a smaller image or contact support for assistance.' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process image' },
      { status: 500 }
    );
  }
}
