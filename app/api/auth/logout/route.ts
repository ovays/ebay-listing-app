import { NextResponse } from 'next/server';
import {
  clearSessionCookie,
  getSessionIdFromCookies,
} from '@/lib/auth/session';
import { buildAppUrl } from '@/lib/app-url';
import { deleteEbayTokenSet } from '@/lib/ebay/token-store';

async function logout(req: Request) {
  const sessionId = await getSessionIdFromCookies();

  if (sessionId) {
    const deleted = await deleteEbayTokenSet(sessionId);
    console.info('[Auth] User logged out', {
      sessionIdPreview: `${sessionId.slice(0, 8)}...`,
      deletedTokenRecord: deleted,
    });
  } else {
    console.info('[Auth] Logout requested without an active session');
  }

  const response = NextResponse.redirect(
    buildAppUrl('/dashboard?auth=logged-out', req)
  );
  clearSessionCookie(response);

  return response;
}

export async function GET(req: Request) {
  return logout(req);
}

export async function POST(req: Request) {
  return logout(req);
}
