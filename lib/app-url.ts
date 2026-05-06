const DEFAULT_LOCAL_APP_URL = 'http://localhost:3000';

function parseUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value.trim());
  } catch {
    console.warn('[App URL] Ignoring invalid URL value', { value });
    return null;
  }
}

function isLocalHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

function firstHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null;
}

function requestBaseUrl(req: Request) {
  const forwardedHost = firstHeaderValue(req.headers.get('x-forwarded-host'));
  const forwardedProto = firstHeaderValue(req.headers.get('x-forwarded-proto'));
  const host = forwardedHost ?? req.headers.get('host');
  const requestUrl = parseUrl(req.url);

  if (!host && !requestUrl) {
    return null;
  }

  const hostname = host?.split(':')[0] ?? requestUrl?.hostname ?? '';
  const protocol = isLocalHostname(hostname)
    ? 'http:'
    : forwardedProto
      ? `${forwardedProto}:`
      : requestUrl?.protocol || 'https:';

  return parseUrl(`${protocol}//${host ?? requestUrl?.host}`);
}

export function getAppBaseUrl(req?: Request) {
  const requestUrl = req ? requestBaseUrl(req) : null;
  const configuredUrl = parseUrl(process.env.NEXT_PUBLIC_APP_URL);
  const baseUrl = requestUrl ?? configuredUrl ?? new URL(DEFAULT_LOCAL_APP_URL);

  if (isLocalHostname(baseUrl.hostname)) {
    baseUrl.protocol = 'http:';
  } else if (configuredUrl && baseUrl.host === configuredUrl.host) {
    baseUrl.protocol = configuredUrl.protocol;
  }

  baseUrl.pathname = '';
  baseUrl.search = '';
  baseUrl.hash = '';

  return baseUrl;
}

export function buildAppUrl(
  path: string,
  req?: Request,
  options: { log?: boolean } = {}
) {
  const url = new URL(path, getAppBaseUrl(req));

  if (options.log !== false) {
    logGeneratedRedirectUrl(url, {
      path,
      request: req,
    });
  }

  return url;
}

export function logGeneratedRedirectUrl(
  url: URL,
  context: { path?: string; request?: Request } = {}
) {
  const { path, request } = context;

  console.info('[App URL] Generated redirect URL', {
    path: path ?? `${url.pathname}${url.search}`,
    url: url.toString(),
    requestUrl: request?.url,
    forwardedHost: request?.headers.get('x-forwarded-host') ?? undefined,
    forwardedProto: request?.headers.get('x-forwarded-proto') ?? undefined,
    configuredAppUrl: process.env.NEXT_PUBLIC_APP_URL,
  });
}
