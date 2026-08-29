import { NextResponse } from 'next/server';

import { fetchYouTubeChannelVideos, fetchYouTubeVideo } from '@/lib/youtube';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  try {
    const video = await fetchYouTubeVideo(id);
    const channel = await fetchYouTubeChannelVideos(video.channelId);
    return NextResponse.json(
      {
        video,
        moreVideos: channel.videos.filter((v) => v.id !== id).slice(0, 20),
      },
      { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=900' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '读取视频失败' },
      { status: 400 }
    );
  }
}
