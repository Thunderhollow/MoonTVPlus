/* eslint-disable @typescript-eslint/no-explicit-any */
export interface YouTubeVideo {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  description: string;
  duration: number;
  durationText: string;
  viewCount?: string;
  channelId?: string;
  channelTitle?: string;
  isShort: boolean;
}
export interface YouTubeChannelFeed {
  channelId: string;
  title: string;
  channelUrl: string;
  videos: YouTubeVideo[];
  nextPageToken?: string;
}
export interface YouTubeComment {
  id: string;
  author: string;
  authorImage: string;
  text: string;
  publishedAt: string;
  likeCount: number;
  replyCount: number;
}

const CHANNEL_ID_PATTERN = /^UC[\w-]{20,}$/;
const API_ROOT = 'https://www.googleapis.com/youtube/v3';
function apiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('服务器尚未设置 YOUTUBE_API_KEY');
  return key;
}
async function youtubeApi(path: string, params: Record<string, string>) {
  const url = new URL(`${API_ROOT}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url, {
    headers: { 'x-goog-api-key': apiKey(), Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body?.error?.message || 'YouTube API 请求失败');
  return body;
}
export function parseDuration(value = 'PT0S') {
  const m = value.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m
    ? Number(m[1] || 0) * 86400 +
        Number(m[2] || 0) * 3600 +
        Number(m[3] || 0) * 60 +
        Number(m[4] || 0)
    : 0;
}
export function formatDuration(s: number) {
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    r = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
}
function extractHandle(input: string) {
  const value = input.trim();
  if (value.startsWith('@')) return value.slice(1);
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    return url.pathname.match(/^\/@([^/]+)/)?.[1] || '';
  } catch {
    return '';
  }
}
export async function resolveYouTubeChannelId(input: string) {
  const value = input.trim();
  if (CHANNEL_ID_PATTERN.test(value)) return value;
  const direct = value.match(/youtube\.com\/channel\/(UC[\w-]{20,})/i)?.[1];
  if (direct) return direct;
  const handle = extractHandle(value);
  if (!handle) throw new Error('请输入频道网址、@账号或频道 ID');
  const result = await youtubeApi('channels', {
    part: 'id',
    forHandle: handle,
  });
  const id = result.items?.[0]?.id;
  if (!id) throw new Error('找不到该 YouTube 频道');
  return id as string;
}
async function videoMetadata(ids: string[]) {
  if (!ids.length) return new Map<string, any>();
  const data = await youtubeApi('videos', {
    part: 'snippet,contentDetails,statistics,status',
    id: ids.join(','),
  });
  return new Map<string, any>(
    (data.items || []).map((item: any) => [item.id, item])
  );
}
export async function fetchYouTubeChannelVideos(
  channelId: string,
  pageToken = ''
): Promise<YouTubeChannelFeed> {
  if (!CHANNEL_ID_PATTERN.test(channelId))
    throw new Error('频道 ID 格式不正确');
  const cd = await youtubeApi('channels', {
    part: 'snippet,contentDetails',
    id: channelId,
  });
  const channel = cd.items?.[0];
  if (!channel) throw new Error('找不到该频道');
  const pd = await youtubeApi('playlistItems', {
    part: 'snippet,contentDetails,status',
    playlistId: channel.contentDetails.relatedPlaylists.uploads,
    maxResults: '50',
    ...(pageToken ? { pageToken } : {}),
  });
  const ids = (pd.items || [])
    .map((x: any) => x.contentDetails?.videoId)
    .filter(Boolean);
  const meta = await videoMetadata(ids);
  const videos: YouTubeVideo[] = (pd.items || []).flatMap((x: any) => {
    const id = x.contentDetails?.videoId,
      detail = meta.get(id);
    if (!detail || detail.status?.privacyStatus !== 'public') return [];
    const d = parseDuration(detail.contentDetails?.duration),
      s = detail.snippet;
    return [
      {
        id,
        title: s.title,
        description: s.description || '',
        publishedAt: s.publishedAt,
        thumbnail:
          s.thumbnails?.maxres?.url ||
          s.thumbnails?.high?.url ||
          s.thumbnails?.medium?.url ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        duration: d,
        durationText: formatDuration(d),
        viewCount: detail.statistics?.viewCount,
        channelId,
        channelTitle: channel.snippet.title,
        isShort: d > 0 && d <= 180,
      },
    ];
  });
  return {
    channelId,
    title: channel.snippet.title,
    channelUrl: `https://www.youtube.com/channel/${channelId}`,
    videos,
    nextPageToken: pd.nextPageToken,
  };
}
export async function fetchYouTubeVideo(id: string) {
  if (!/^[\w-]{6,20}$/.test(id)) throw new Error('视频 ID 格式不正确');
  const detail = (await videoMetadata([id])).get(id);
  if (!detail) throw new Error('找不到该视频');
  const d = parseDuration(detail.contentDetails?.duration),
    s = detail.snippet;
  return {
    id,
    title: s.title,
    description: s.description || '',
    publishedAt: s.publishedAt,
    thumbnail:
      s.thumbnails?.high?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    duration: d,
    durationText: formatDuration(d),
    viewCount: detail.statistics?.viewCount,
    likeCount: detail.statistics?.likeCount,
    commentCount: detail.statistics?.commentCount,
    channelId: s.channelId,
    channelTitle: s.channelTitle,
    isShort: d > 0 && d <= 180,
  };
}
export async function fetchYouTubeComments(id: string, pageToken = '') {
  const data = await youtubeApi('commentThreads', {
    part: 'snippet',
    videoId: id,
    maxResults: '20',
    order: 'relevance',
    textFormat: 'plainText',
    ...(pageToken ? { pageToken } : {}),
  });
  const comments: YouTubeComment[] = (data.items || []).map((x: any) => {
    const t = x.snippet,
      c = t.topLevelComment.snippet;
    return {
      id: x.id,
      author: c.authorDisplayName,
      authorImage: c.authorProfileImageUrl,
      text: c.textDisplay,
      publishedAt: c.publishedAt,
      likeCount: c.likeCount || 0,
      replyCount: t.totalReplyCount || 0,
    };
  });
  return { comments, nextPageToken: data.nextPageToken as string | undefined };
}
