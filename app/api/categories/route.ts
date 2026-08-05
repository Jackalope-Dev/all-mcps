import { NextResponse } from 'next/server';
import { GET as getV1Categories } from '../v1/categories/route';

export async function GET() {
  return getV1Categories();
}
