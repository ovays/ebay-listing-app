import { NextRequest, NextResponse } from 'next/server';
import { buildAppUrl, logGeneratedRedirectUrl } from '@/lib/app-url';
import { createSessionId, setSessionCookie } from '@/lib/auth/session';
import {
  exchangeEbayAuthorizationCode,
  getEbayOAuthConfig,
  getMaskedEbayOAuthConfig,
} from '@/lib/ebay/oauth';
import { saveEbayTokenSet } from '@/lib/ebay/token-store';

function redirectToDashboard(req: Request, params: Record<string, string>) {
  const url = buildAppUrl('/dashboard', req, { log: false });

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  logGeneratedRedirectUrl(url, { request: req });

  const response = NextResponse.redirect(url);
  response.cookies.set('ebay_oauth_state', '', {
    httpOnly: true,
    path: '/api/ebay/callback',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });

  return response;
}

export async function GET(req: NextRequest) {
  const callbackUrl = new URL(req.url);
  const { searchParams } = callbackUrl;
  const code = searchParams.get('code');
  const returnedState = searchParams.get('state');
  const oauthError = searchParams.get('error') ?? searchParams.get('errorId');
  const oauthErrorDescription = searchParams.get('error_description');

  console.info('[eBay OAuth] Callback received', {
    pathname: callbackUrl.pathname,
    hasCode: Boolean(code),
    hasState: Boolean(returnedState),
  });

  if (oauthError) {
    console.error('[eBay OAuth] Authorization endpoint returned an error', {
      error: oauthError,
      errorDescription: oauthErrorDescription,
    });

    return redirectToDashboard(req, {
      auth: 'error',
      message: oauthErrorDescription ?? oauthError,
    });
  }

  if (!code) {
    console.error('[eBay OAuth] Callback did not include an authorization code');

    return redirectToDashboard(req, {
      auth: 'error',
      message: 'Missing eBay authorization code.',
    });
  }

  try {
    const config = getEbayOAuthConfig();
    const expectedState = req.cookies.get('ebay_oauth_state')?.value;

    if (!expectedState || returnedState !== expectedState) {
      console.error('[eBay OAuth] State mismatch on callback', {
        returnedStateLength: returnedState?.length ?? 0,
        expectedStateLength: expectedState?.length ?? 0,
      });

      return redirectToDashboard(req, {
        auth: 'error',
        message: 'Invalid eBay OAuth state. Please try logging in again.',
      });
    }

    console.info('[eBay OAuth] Exchanging authorization code for token', {
      ...getMaskedEbayOAuthConfig(config),
      codeLength: code.length,
      hasState: Boolean(returnedState),
    });

    const tokenSet = await exchangeEbayAuthorizationCode(config, code);
    const sessionId = createSessionId();
    await saveEbayTokenSet(sessionId, tokenSet);
console.info("FULL TOKEN SET:", JSON.stringify(tokenSet, null, 2));
    console.info('[eBay OAuth3] Token exchange succeeded', {
      sessionIdPreview: `${sessionId.slice(0, 8)}...`,
      environment: tokenSet.environment,
      accessTokenExpiresAt: tokenSet.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokenSet.refreshTokenExpiresAt,
      tokenType: tokenSet.tokenType,
      scopes: tokenSet.scope,
    });

    const response = redirectToDashboard(req, { auth: 'success' });
    setSessionCookie(response, sessionId);

    return response;
  } catch (error) {
    console.error('[eBay OAuth] Callback failed', error);

    return redirectToDashboard(req, {
      auth: 'error',
      message:
        error instanceof Error ? error.message : 'eBay OAuth callback failed.',
    });
  }
}
