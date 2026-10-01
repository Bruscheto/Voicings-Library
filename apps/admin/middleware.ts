import { NextResponse, type NextRequest } from 'next/server';
import { authorizeAdmin } from './lib/auth';

export async function middleware(request: NextRequest) {
  return (await authorizeAdmin(request)) ?? NextResponse.next();
}

export const config = { matcher: '/:path*' };
