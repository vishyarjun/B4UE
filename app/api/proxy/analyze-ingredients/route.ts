import { NextResponse } from 'next/server';

export const maxDuration = 60; 
export const dynamic = 'force-dynamic'; 

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    console.log('Analyze ingredients proxy: Starting request to external API');
    console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
    console.log('Token present:', !!process.env.API_TOKEN);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); 

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
      const errorText = await response.text();
      console.error('Analyze ingredients proxy: External API error', {
        status: response.status,
        statusText: response.statusText,
        responseBody: errorText
      });
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const result = await response.json();
    console.log('Analyze ingredients proxy: Successfully processed request');
    return NextResponse.json(result);
  } catch (error) {
    console.error('Analyze ingredients proxy: Detailed error:', {
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
        { error: 'Request timed out. The ingredient analysis is taking longer than expected. Please try with fewer ingredients or contact support for assistance.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze ingredients' },
      { status: 500 }
    );
  }
}
