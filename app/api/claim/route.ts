import { NextResponse } from 'next/server';
import { claimListing } from '../../../lib/claimListing';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const outcome = await claimListing(body);
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
