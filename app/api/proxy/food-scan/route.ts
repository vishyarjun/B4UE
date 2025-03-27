import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const formData = await request.formData();
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/food-scan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in food-scan proxy:', error);
    return NextResponse.json(
      { error: 'Failed to process food image' },
      { status: 500 }
    );
  }
}
