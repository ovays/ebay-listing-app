import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import type { EbayEnvironment } from './oauth';

export type EbayTokenSet = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scope?: string;
  environment: EbayEnvironment;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt?: string;
};

export type StoredEbayTokenSummary = Omit<
  EbayTokenSet,
  'accessToken' | 'refreshToken'
> & {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  hasRefreshToken: boolean;
};

type EncryptedValue = {
  iv: string;
  tag: string;
  value: string;
};

type StoredRecord = {
  environment: EbayEnvironment;
  tokenType: string;
  scope?: string;
  accessToken: EncryptedValue;
  refreshToken: EncryptedValue;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

type TokenStoreFile = {
  version: 1;
  records: Record<string, StoredRecord>;
};

const TOKEN_STORE_DIR = path.join(process.cwd(), '.data');
const TOKEN_STORE_PATH = path.join(TOKEN_STORE_DIR, 'ebay-oauth-tokens.json');

let warnedAboutDevFallback = false;

function getEncryptionKey() {
  const configuredKey = process.env.EBAY_TOKEN_ENCRYPTION_KEY?.trim();

  if (configuredKey) {
    return createHash('sha256').update(configuredKey).digest();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('EBAY_TOKEN_ENCRYPTION_KEY must be set in production');
  }

  const fallback = process.env.EBAY_CLIENT_SECRET?.trim();

  if (!fallback) {
    throw new Error(
      'Missing EBAY_TOKEN_ENCRYPTION_KEY or EBAY_CLIENT_SECRET for token encryption'
    );
  }

  if (!warnedAboutDevFallback) {
    console.warn(
      '[eBay OAuth] EBAY_TOKEN_ENCRYPTION_KEY is not set; using development-only encryption fallback'
    );
    warnedAboutDevFallback = true;
  }

  return createHash('sha256').update(`dev:${fallback}`).digest();
}

function encrypt(value: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);

  return {
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    value: encrypted.toString('base64url'),
  };
}

function decrypt(value: EncryptedValue) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(value.iv, 'base64url')
  );

  decipher.setAuthTag(Buffer.from(value.tag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(value.value, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

async function readStore(): Promise<TokenStoreFile> {
  try {
    const raw = await readFile(TOKEN_STORE_PATH, 'utf8');
    return JSON.parse(raw) as TokenStoreFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1, records: {} };
    }

    throw error;
  }
}

async function writeStore(store: TokenStoreFile) {
  await mkdir(TOKEN_STORE_DIR, { recursive: true });

  const tempPath = `${TOKEN_STORE_PATH}.${process.pid}.tmp`;
  await writeFile(tempPath, JSON.stringify(store, null, 2), {
    mode: 0o600,
  });
  await rename(tempPath, TOKEN_STORE_PATH);
}

export async function saveEbayTokenSet(
  sessionId: string,
  tokenSet: EbayTokenSet
) {
  const store = await readStore();
  const existing = store.records[sessionId];
  const now = new Date().toISOString();

  store.records[sessionId] = {
    environment: tokenSet.environment,
    tokenType: tokenSet.tokenType,
    scope: tokenSet.scope,
    accessToken: encrypt(tokenSet.accessToken),
    refreshToken: encrypt(tokenSet.refreshToken),
    accessTokenExpiresAt: tokenSet.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokenSet.refreshTokenExpiresAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await writeStore(store);
}

export async function getEbayTokenSet(sessionId: string) {
  const store = await readStore();
  const record = store.records[sessionId];

  if (!record) {
    return null;
  }

  return {
    environment: record.environment,
    tokenType: record.tokenType,
    scope: record.scope,
    accessToken: decrypt(record.accessToken),
    refreshToken: decrypt(record.refreshToken),
    accessTokenExpiresAt: record.accessTokenExpiresAt,
    refreshTokenExpiresAt: record.refreshTokenExpiresAt,
  } satisfies EbayTokenSet;
}

export async function getEbayTokenSummary(sessionId: string) {
  const store = await readStore();
  const record = store.records[sessionId];

  if (!record) {
    return null;
  }

  return {
    sessionId,
    environment: record.environment,
    tokenType: record.tokenType,
    scope: record.scope,
    accessTokenExpiresAt: record.accessTokenExpiresAt,
    refreshTokenExpiresAt: record.refreshTokenExpiresAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    hasRefreshToken: Boolean(record.refreshToken),
  } satisfies StoredEbayTokenSummary;
}

export async function deleteEbayTokenSet(sessionId: string) {
  const store = await readStore();

  if (!store.records[sessionId]) {
    return false;
  }

  delete store.records[sessionId];
  await writeStore(store);
  return true;
}
