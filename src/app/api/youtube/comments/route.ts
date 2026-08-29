import { NextResponse } from 'next/server';

import { fetchYouTubeComments } from '@/lib/youtube';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  try {
    return NextResponse.json(
      await fetchYouTubeComments(p.get('id') || '', p.get('pageToken') || ''),
      { headers: { 'Cache-Control': 'public, max-age=120, s-maxage=300' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '读取评论失败' },
      { status: 400 }
    );
  }
}
