'use client';
import { Loader2, Plus, Trash2, Youtube } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import type { YouTubeChannelFeed, YouTubeVideo } from '@/lib/youtube';

import PageLayout from '@/components/PageLayout';

const STORAGE_KEY = 'moontv-youtube-channels';
type Tab = 'all' | 'videos' | 'shorts';
interface SavedChannel {
  id: string;
  title: string;
  url: string;
}
async function syncChannels(channels?: SavedChannel[]) {
  const response = await fetch('/api/youtube/subscriptions', {
    method: channels ? 'PUT' : 'GET',
    headers: channels ? { 'Content-Type': 'application/json' } : undefined,
    body: channels ? JSON.stringify({ channels }) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '频道同步失败');
  return (result.channels || []) as SavedChannel[];
}
async function requestChannel(input: string, pageToken = '') {
  const r = await fetch(
    `/api/youtube/channel?input=${encodeURIComponent(input)}${
      pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
    }`
  );
  const x = await r.json();
  if (!r.ok) throw new Error(x.error || '读取频道失败');
  return x as YouTubeChannelFeed;
}
function VideoCard({ video }: { video: YouTubeVideo }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/youtube/watch?v=${video.id}`)}
      className='group overflow-hidden rounded-xl border border-gray-200/70 bg-white/70 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900/70'
    >
      <div className='relative aspect-video overflow-hidden bg-gray-200'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnail}
          alt=''
          loading='lazy'
          className='h-full w-full object-cover transition group-hover:scale-105'
        />
        <span className='absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white'>
          {video.durationText}
        </span>
        {video.isShort && (
          <span className='absolute left-2 top-2 rounded bg-red-600 px-2 py-0.5 text-xs text-white'>
            Shorts
          </span>
        )}
      </div>
      <div className='p-3'>
        <h3 className='line-clamp-2 min-h-10 font-medium text-gray-900 dark:text-white'>
          {video.title}
        </h3>
        <p className='mt-2 text-xs text-gray-500'>
          {video.viewCount
            ? `${Number(video.viewCount).toLocaleString()} 次观看 · `
            : ''}
          {new Date(video.publishedAt).toLocaleDateString()}
        </p>
      </div>
    </button>
  );
}
export default function YouTubePage() {
  const [input, setInput] = useState('');
  const [channels, setChannels] = useState<SavedChannel[]>([]);
  const [activeId, setActiveId] = useState('');
  const [feed, setFeed] = useState<YouTubeChannelFeed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [syncWarning, setSyncWarning] = useState('');
  useEffect(() => {
    let localChannels: SavedChannel[] = [];
    try {
      const x = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(x)) {
        localChannels = x;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    void syncChannels()
      .then(async (remoteChannels) => {
        const resolved =
          remoteChannels.length === 0 && localChannels.length > 0
            ? await syncChannels(localChannels)
            : remoteChannels;
        setChannels(resolved);
        setActiveId(resolved[0]?.id || '');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
      })
      .catch(() => {
        setChannels(localChannels);
        setActiveId(localChannels[0]?.id || '');
        setSyncWarning('云端同步暂时不可用，目前仅保存在此设备');
      });
  }, []);
  const save = (x: SavedChannel[]) => {
    setChannels(x);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(x));
    void syncChannels(x)
      .then(() => setSyncWarning(''))
      .catch(() => setSyncWarning('云端同步失败，变更目前仅保存在此设备'));
  };
  const load = useCallback(
    async (id: string, more = false) => {
      if (!id) {
        setFeed(null);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const x = await requestChannel(id, more ? feed?.nextPageToken : '');
        setFeed((old) =>
          more && old ? { ...x, videos: [...old.videos, ...x.videos] } : x
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : '读取频道失败');
      } finally {
        setLoading(false);
      }
    },
    [feed?.nextPageToken]
  );
  useEffect(() => {
    void load(activeId);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    try {
      const x = await requestChannel(input);
      const c = { id: x.channelId, title: x.title, url: x.channelUrl };
      save([c, ...channels.filter((v) => v.id !== c.id)]);
      setFeed(x);
      setActiveId(c.id);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setLoading(false);
    }
  };
  const visible = useMemo(
    () =>
      feed?.videos.filter(
        (v) => tab === 'all' || (tab === 'shorts' ? v.isShort : !v.isShort)
      ) || [],
    [feed, tab]
  );
  return (
    <PageLayout activePath='/youtube'>
      <div className='mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10'>
        <div className='mb-6 flex items-center gap-3'>
          <Youtube className='h-8 w-8 text-red-600' />
          <div>
            <h1 className='text-2xl font-bold dark:text-white'>YouTube 频道</h1>
            <p className='text-sm text-gray-500'>浏览频道的全部公开视频</p>
          </div>
        </div>
        <form onSubmit={add} className='mb-6 flex flex-col gap-2 sm:flex-row'>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='频道网址、@账号或频道 ID'
            className='min-w-0 flex-1 rounded-xl border bg-white/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
          />
          <button
            disabled={loading || !input.trim()}
            className='flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-medium text-white disabled:opacity-50'
          >
            {loading ? (
              <Loader2 className='h-5 w-5 animate-spin' />
            ) : (
              <Plus className='h-5 w-5' />
            )}
            添加频道
          </button>
        </form>
        {error && (
          <div className='mb-5 rounded-xl bg-red-50 p-3 text-red-700 dark:bg-red-950 dark:text-red-300'>
            {error}
          </div>
        )}
        {syncWarning && (
          <div className='mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200'>
            {syncWarning}
          </div>
        )}
        <div className='mb-6 flex gap-2 overflow-x-auto'>
          {channels.map((c) => (
            <div
              key={c.id}
              className={`flex flex-none items-center rounded-full border ${
                activeId === c.id
                  ? 'border-green-500 bg-green-500/10'
                  : 'dark:border-gray-700'
              }`}
            >
              <button
                onClick={() => setActiveId(c.id)}
                className='max-w-52 truncate py-2 pl-4 pr-2'
              >
                {c.title}
              </button>
              <button
                onClick={() => {
                  const x = channels.filter((v) => v.id !== c.id);
                  save(x);
                  if (activeId === c.id) setActiveId(x[0]?.id || '');
                }}
                className='mr-1 p-1.5'
              >
                <Trash2 className='h-4 w-4' />
              </button>
            </div>
          ))}
        </div>
        {feed && (
          <>
            <div className='mb-5 flex flex-wrap items-end justify-between gap-3'>
              <div>
                <h2 className='text-xl font-semibold dark:text-white'>
                  {feed.title}
                </h2>
                <p className='text-sm text-gray-500'>
                  {feed.videos.length} 个已加载视频
                </p>
              </div>
              <div className='flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800'>
                {(
                  [
                    ['all', '全部'],
                    ['videos', '视频'],
                    ['shorts', 'Shorts'],
                  ] as [Tab, string][]
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`rounded-lg px-4 py-2 text-sm ${
                      tab === k
                        ? 'bg-white font-medium shadow dark:bg-gray-700'
                        : ''
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className='grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
              {visible.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
            {feed.nextPageToken && (
              <div className='mt-8 text-center'>
                <button
                  onClick={() => void load(feed.channelId, true)}
                  disabled={loading}
                  className='rounded-xl bg-green-600 px-6 py-3 font-medium text-white disabled:opacity-50'
                >
                  {loading ? '正在加载…' : '加载更多视频'}
                </button>
              </div>
            )}
          </>
        )}
        {loading && !feed && (
          <div className='flex min-h-64 items-center justify-center'>
            <Loader2 className='mr-2 animate-spin' />
            正在加载…
          </div>
        )}
        {!loading && !feed && (
          <div className='flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed dark:border-gray-700'>
            <Youtube className='mb-3 h-12 w-12 text-gray-400' />
            <p>添加一个频道即可开始</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
