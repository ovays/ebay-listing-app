export type EbayEnvironment = 'sandbox' | 'production';

type EbayOAuthConfig = {
  clientId: string;
  clientSecret: string;
  environment: EbayEnvironment;
  redirectUri: string;
  scopes: string[];
};

const EBAY_ENDPOINTS: Record<
  EbayEnvironment,
  { authorizeUrl: string; tokenUrl: string }
> = {
  sandbox: {
    authorizeUrl: 'https://auth.sandbox.ebay.com/oauth2/authorize',
    tokenUrl: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
  },
  production: {
    authorizeUrl: 'https://auth.ebay.com/oauth2/authorize',
    tokenUrl: 'https://api.ebay.com/identity/v1/oauth2/token',
  },
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizeEnvironment(value: string | undefined): EbayEnvironment {
  const environment = value?.trim().toLowerCase();

  if (!environment) {
    return 'sandbox';
  }

  if (environment === 'sandbox' || environment === 'production') {
    return environment;
  }

  throw new Error('EBAY_ENV must be either "sandbox" or "production"');
}

function normalizeScopes(value: string) {
  return value
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function getEbayOAuthConfig(): EbayOAuthConfig {
  const scopes = normalizeScopes(requiredEnv('EBAY_SCOPE'));

  if (scopes.length === 0) {
    throw new Error('EBAY_SCOPE must contain at least one OAuth scope');
  }

  return {
    clientId: requiredEnv('EBAY_CLIENT_ID'),
    clientSecret: requiredEnv('EBAY_CLIENT_SECRET'),
    environment: normalizeEnvironment(process.env.EBAY_ENV),
    redirectUri: requiredEnv('EBAY_REDIRECT_URI'),
    scopes,
  };
}

export function getEbayOAuthEndpoints(environment: EbayEnvironment) {
  return EBAY_ENDPOINTS[environment];
}

export function buildEbayAuthorizationUrl(config: EbayOAuthConfig, state: string) {
  const { authorizeUrl } = getEbayOAuthEndpoints(config.environment);
  const params = [
    ['client_id', config.clientId],
    ['redirect_uri', config.redirectUri],
    ['response_type', 'code'],
    ['scope', config.scopes.join(' ')],
    ['state', state],
  ];

  const query = params
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return `${authorizeUrl}?${query}`;
}

export function getMaskedEbayOAuthConfig(config: EbayOAuthConfig) {
  return {
    clientId: config.clientId,
    environment: config.environment,
    redirectUri: config.redirectUri,
    scopes: config.scopes,
  };
}

type EbayTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  token_type: string;
  scope?: string;
};

function getBasicAuthorizationHeader(config: EbayOAuthConfig) {
  return (
    'Basic ' +
    Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
  );
}

function expiresAtFromNow(seconds: number | undefined) {
  if (!seconds) {
    return undefined;
  }

  return new Date(Date.now() + seconds * 1000).toISOString();
}

export async function exchangeEbayAuthorizationCode(
  config: EbayOAuthConfig,
  code: string
) {
  const { tokenUrl } = getEbayOAuthEndpoints(config.environment);
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: getBasicAuthorizationHeader(config),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  const data = (await res.json()) as Partial<EbayTokenResponse> & {
    error?: string;
    error_description?: string;
  };

  if (!res.ok) {
    throw new Error(
      `eBay token exchange failed with ${res.status}: ${
        data.error_description ?? data.error ?? res.statusText
      }`
    );
  }

  if (!data.access_token || !data.refresh_token || !data.expires_in) {
    throw new Error('eBay token response did not include required tokens');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type ?? 'Bearer',
    scope: data.scope,
    environment: config.environment,
    accessTokenExpiresAt:
      expiresAtFromNow(data.expires_in) ?? new Date(Date.now()).toISOString(),
    refreshTokenExpiresAt: expiresAtFromNow(data.refresh_token_expires_in),
    expiresIn: data.expires_in,
    refreshTokenExpiresIn: data.refresh_token_expires_in,
  };
}

export async function refreshEbayAccessToken(
  config: EbayOAuthConfig,
  refreshToken: string
) {
  const { tokenUrl } = getEbayOAuthEndpoints(config.environment);
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: getBasicAuthorizationHeader(config),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: config.scopes.join(' '),
    }),
  });

  const data = (await res.json()) as Partial<EbayTokenResponse> & {
    error?: string;
    error_description?: string;
  };

  if (!res.ok) {
    throw new Error(
      `eBay token refresh failed with ${res.status}: ${
        data.error_description ?? data.error ?? res.statusText
      }`
    );
  }

  if (!data.access_token || !data.expires_in) {
    throw new Error('eBay refresh response did not include an access token');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    tokenType: data.token_type ?? 'Bearer',
    scope: data.scope,
    environment: config.environment,
    accessTokenExpiresAt:
      expiresAtFromNow(data.expires_in) ?? new Date(Date.now()).toISOString(),
    refreshTokenExpiresAt: expiresAtFromNow(data.refresh_token_expires_in),
    expiresIn: data.expires_in,
    refreshTokenExpiresIn: data.refresh_token_expires_in,
  };
}
