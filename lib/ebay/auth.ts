import { getSessionIdFromCookies } from '@/lib/auth/session';
import {
  getEbayOAuthConfig,
  getMaskedEbayOAuthConfig,
  refreshEbayAccessToken,
} from '@/lib/ebay/oauth';
import {
  getEbayTokenSet,
  saveEbayTokenSet,
  type EbayTokenSet,
} from '@/lib/ebay/token-store';

const ACCESS_TOKEN_REFRESH_WINDOW_MS = 2 * 60 * 1000;

function shouldRefreshAccessToken(tokenSet: EbayTokenSet) {
  return (
    new Date(tokenSet.accessTokenExpiresAt).getTime() - Date.now() <=
    ACCESS_TOKEN_REFRESH_WINDOW_MS
  );
}

export async function requireEbayAuth() {
  const sessionId = await getSessionIdFromCookies();

  if (!sessionId) {
    return null;
  }

  const tokenSet = await getEbayTokenSet(sessionId);

  if (!tokenSet) {
    return null;
  }

  if (!shouldRefreshAccessToken(tokenSet)) {
    return { sessionId, tokenSet };
  }

  const config = getEbayOAuthConfig();

  if (config.environment !== tokenSet.environment) {
    console.warn('[eBay OAuth] Session environment differs from current config', {
      sessionEnvironment: tokenSet.environment,
      configEnvironment: config.environment,
    });
  }

  console.info('[eBay OAuth] Refreshing expired access token', {
    ...getMaskedEbayOAuthConfig(config),
    sessionIdPreview: `${sessionId.slice(0, 8)}...`,
    accessTokenExpiresAt: tokenSet.accessTokenExpiresAt,
  });

  const refreshedTokenSet = await refreshEbayAccessToken(
    config,
    tokenSet.refreshToken
  );

  await saveEbayTokenSet(sessionId, {
    ...refreshedTokenSet,
    refreshTokenExpiresAt:
      refreshedTokenSet.refreshTokenExpiresAt ?? tokenSet.refreshTokenExpiresAt,
  });

  console.info('[eBay OAuth] Access token refreshed', {
    sessionIdPreview: `${sessionId.slice(0, 8)}...`,
    accessTokenExpiresAt: refreshedTokenSet.accessTokenExpiresAt,
  });

  return { sessionId, tokenSet: refreshedTokenSet };
}
