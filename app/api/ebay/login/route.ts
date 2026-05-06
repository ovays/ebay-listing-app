import { NextResponse } from 'next/server';
import {
  buildEbayAuthorizationUrl,
  getEbayOAuthConfig,
  getMaskedEbayOAuthConfig,
} from '@/lib/ebay/oauth';

export async function GET() {
  try {
    const config = getEbayOAuthConfig();
    const state = crypto.randomUUID();
    const authorizeUrl = buildEbayAuthorizationUrl(config, state);

    console.info('[eBay OAuth] Redirecting to authorization endpoint', {
      ...getMaskedEbayOAuthConfig(config),
      responseType: 'code',
      stateLength: state.length,
      authorizeUrlPreview: authorizeUrl.replace(state, '[state]'),
    });

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set('ebay_oauth_state', state, {
      httpOnly: true,
      path: '/api/ebay/callback',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60,
    });

    return response;
  } catch (error) {
    console.error('[eBay OAuth] Login configuration error', error);

    return NextResponse.json(
      {
        error: 'eBay OAuth is not configured correctly.',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
