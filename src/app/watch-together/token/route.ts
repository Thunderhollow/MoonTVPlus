import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { createWatchTogetherToken, getWatchTogetherUsers, isWatchTogetherUser } from '@/lib/watch-together-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!isWatchTogetherUser(authInfo)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({
    token: createWatchTogetherToken(authInfo.username),
    username: authInfo.username,
    users: getWatchTogetherUsers(),
  });
}
