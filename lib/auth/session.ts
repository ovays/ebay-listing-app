import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

export const EBAY_SESSION_COOKIE = 'ebay_session';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function getSessionSecret() {
  const secret =
    process.env.AUTH_SESSION_SECRET?.trim() ||
    process.env.EBAY_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.EBAY_CLIENT_SECRET?.trim();

  if (!secret) {
    throw new Error(
      'Missing AUTH_SESSION_SECRET, EBAY_TOKEN_ENCRYPTION_KEY, or EBAY_CLIENT_SECRET'
    );
  }

  if (process.env.NODE_ENV === 'production' && !process.env.AUTH_SESSION_SECRET) {
    throw new Error('AUTH_SESSION_SECRET must be set in production');
  }

  return secret;
}

function signSessionId(sessionId: string) {
  return createHmac('sha256', getSessionSecret())
    .update(sessionId)
    .digest('base64url');
}

export function createSessionId() {
  return randomBytes(32).toString('base64url');
}

export function createSessionCookieValue(sessionId: string) {
  return `${sessionId}.${signSessionId(sessionId)}`;
}

export function verifySessionCookieValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  const [sessionId, signature] = value.split('.');

  if (!sessionId || !signature) {
    return null;
  }

  const expected = signSessionId(sessionId);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  return sessionId;
}

export async function getSessionIdFromCookies() {
  const cookieStore = await cookies();
  return verifySessionCookieValue(cookieStore.get(EBAY_SESSION_COOKIE)?.value);
}

export function setSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(EBAY_SESSION_COOKIE, createSessionCookieValue(sessionId), {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(EBAY_SESSION_COOKIE, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });
}
