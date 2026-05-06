import { NextResponse } from 'next/server';
import { getSessionIdFromCookies } from '@/lib/auth/session';
import { getEbayTokenSummary } from '@/lib/ebay/token-store';

export async function GET() {
  const sessionId = await getSessionIdFromCookies();

  if (!sessionId) {
    return NextResponse.json({ authenticated: false });
  }

  const tokenSummary = await getEbayTokenSummary(sessionId);

  if (!tokenSummary) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    ebay: {
      environment: tokenSummary.environment,
      tokenType: tokenSummary.tokenType,
      scope: tokenSummary.scope,
      accessTokenExpiresAt: tokenSummary.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokenSummary.refreshTokenExpiresAt,
      connectedAt: tokenSummary.createdAt,
      updatedAt: tokenSummary.updatedAt,
      hasRefreshToken: tokenSummary.hasRefreshToken,
    },
  });
}
