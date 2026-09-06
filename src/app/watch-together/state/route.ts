import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { isWatchTogetherUser } from '@/lib/watch-together-auth';
import { getWatchTogetherState, saveWatchTogetherState } from '@/lib/watch-together-state';
import type { WatchTogetherState } from '@/types/watch-together';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!isWatchTogetherUser(authInfo)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ state: await getWatchTogetherState() });
}

export async function PUT(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!isWatchTogetherUser(authInfo)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const input = (await request.json()) as WatchTogetherState;
  if (!input?.actionId || !input?.contentId || !input?.route?.startsWith('/') || input.actorUsername !== authInfo.username) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
  }
  const state = await saveWatchTogetherState({ ...input, sessionId: 'default', serverUpdatedAt: Date.now() });
  return NextResponse.json({ state });
}
