import crypto from 'crypto';

import type { AuthInfo } from './auth';

interface TokenPayload {
  username: string;
  exp: number;
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

export function getWatchTogetherUsers(): string[] {
  return (process.env.WATCH_TOGETHER_USERS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 2);
}

export function isWatchTogetherUser(authInfo: AuthInfo | null): authInfo is AuthInfo & { username: string } {
  return Boolean(
    process.env.WATCH_TOGETHER_ENABLED === 'true' &&
      authInfo?.username &&
      getWatchTogetherUsers().includes(authInfo.username)
  );
}

export function createWatchTogetherToken(username: string, ttlSeconds = 3600): string {
  const secret = process.env.WATCH_TOGETHER_TOKEN_SECRET;
  if (!secret) throw new Error('WATCH_TOGETHER_TOKEN_SECRET is required');
  const payload = base64url(JSON.stringify({ username, exp: Math.floor(Date.now() / 1000) + ttlSeconds } satisfies TokenPayload));
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyWatchTogetherToken(token: string | undefined): TokenPayload | null {
  const secret = process.env.WATCH_TOGETHER_TOKEN_SECRET;
  if (!secret || !token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenPayload;
    if (!decoded.username || decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!getWatchTogetherUsers().includes(decoded.username)) return null;
    return decoded;
  } catch {
    return null;
  }
}
