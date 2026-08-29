'use client';
import { ExternalLink, Loader2, MessageCircle, ThumbsUp } from 'lucide-react';
import { useRouter,useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import type { YouTubeComment, YouTubeVideo } from '@/lib/youtube';

import PageLayout from '@/components/PageLayout';

interface DetailVideo extends YouTubeVideo {
  likeCount?: string;
  commentCount?: string;
}
function count(value?: string) {
  return value ? Number(value).toLocaleString() : '0';
}
function WatchContent() {
  const params = useSearchParams(),
    router = useRouter(),
    id = params.get('v') || '';
  const [video, setVideo] = useState<DetailVideo | null>(null);
  const [more, setMore] = useState<YouTubeVideo[]>([]);
  const [comments, setComments] = useState<YouTubeComment[]>([]);
  const [next, setNext] = useState('');
  const [loading, setLoading] = useState(true);
  const [commentError, setCommentError] = useState('');
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/youtube/video?id=${encodeURIComponent(id)}`).then((r) =>
        r.json()
      ),
      fetch(`/api/youtube/comments?id=${encodeURIComponent(id)}`).then((r) =>
        r.json()
      ),
    ])
      .then(([d, c]) => {
        if (d.error) throw new Error(d.error);
        setVideo(d.video);
        setMore(d.moreVideos || []);
        if (c.error) setCommentError(c.error);
        else {
          setComments(c.comments || []);
          setNext(c.nextPageToken || '');
        }
      })
      .catch((e) => setCommentError(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  const loadComments = async () => {
    const r = await fetch(
        `/api/youtube/comments?id=${encodeURIComponent(
          id
        )}&pageToken=${encodeURIComponent(next)}`
      ),
      x = await r.json();
    if (x.error) {
      setCommentError(x.error);
      return;
    }
    setComments((v) => [...v, ...x.comments]);
    setNext(x.nextPageToken || '');
  };
  if (loading)
    return (
      <div className='flex min-h-[70vh] items-center justify-center'>
        <Loader2 className='mr-2 animate-spin' />
        正在加载视频…
      </div>
    );
  if (!video)
    return (
      <div className='p-10 text-center'>无法读取此视频：{commentError}</div>
    );
  return (
    <div className='mx-auto grid max-w-[1500px] gap-6 px-3 py-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-6'>
      <div className='min-w-0'>
        <div className='aspect-video overflow-hidden rounded-xl bg-black'>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&playsinline=1`}
            title={video.title}
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            referrerPolicy='strict-origin-when-cross-origin'
            allowFullScreen
            className='h-full w-full'
          />
        </div>
        <h1 className='mt-4 text-xl font-bold dark:text-white'>
          {video.title}
        </h1>
        <div className='mt-3 flex flex-wrap items-center justify-between gap-3'>
          <div>
            <p className='font-semibold dark:text-white'>
              {video.channelTitle}
            </p>
            <p className='text-sm text-gray-500'>
              {count(video.viewCount)} 次观看
            </p>
          </div>
          <div className='flex gap-2'>
            <span className='flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 dark:bg-gray-800'>
              <ThumbsUp className='h-4 w-4' />
              {count(video.likeCount)}
            </span>
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target='_blank'
              rel='noreferrer'
              className='flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 dark:bg-gray-800'
            >
              <ExternalLink className='h-4 w-4' />
              YouTube
            </a>
          </div>
        </div>
        <div className='mt-4 whitespace-pre-wrap rounded-xl bg-gray-100 p-4 text-sm dark:bg-gray-800 dark:text-gray-200'>
          <p className='mb-2 font-medium'>
            {new Date(video.publishedAt).toLocaleDateString()}
          </p>
          {video.description || '没有视频简介'}
        </div>
        <section className='mt-7'>
          <h2 className='mb-5 flex items-center gap-2 text-lg font-bold dark:text-white'>
            <MessageCircle className='h-5 w-5' />
            {count(video.commentCount)} 条评论
          </h2>
          {commentError && (
            <p className='rounded-lg bg-gray-100 p-4 text-gray-500 dark:bg-gray-800'>
              {commentError}
            </p>
          )}
          <div className='space-y-6'>
            {comments.map((c) => (
              <div key={c.id} className='flex gap-3'>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.authorImage}
                  alt=''
                  className='h-10 w-10 rounded-full'
                />
                <div className='min-w-0'>
                  <p className='text-sm font-semibold dark:text-white'>
                    {c.author}{' '}
                    <span className='font-normal text-gray-500'>
                      · {new Date(c.publishedAt).toLocaleDateString()}
                    </span>
                  </p>
                  <p className='mt-1 whitespace-pre-wrap text-sm dark:text-gray-200'>
                    {c.text}
                  </p>
                  <p className='mt-2 text-xs text-gray-500'>
                    👍 {c.likeCount}
                    {c.replyCount ? ` · ${c.replyCount} 条回复` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {next && (
            <button
              onClick={() => void loadComments()}
              className='mt-6 rounded-full border px-5 py-2 dark:border-gray-700'
            >
              加载更多评论
            </button>
          )}
        </section>
      </div>
      <aside>
        <h2 className='mb-3 font-semibold dark:text-white'>
          更多来自此频道的视频
        </h2>
        <div className='space-y-3'>
          {more.map((v) => (
            <button
              key={v.id}
              onClick={() => router.push(`/youtube/watch?v=${v.id}`)}
              className='flex w-full gap-3 text-left'
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.thumbnail}
                alt=''
                className='aspect-video w-40 rounded-lg object-cover'
              />
              <div className='min-w-0'>
                <p className='line-clamp-2 text-sm font-medium dark:text-white'>
                  {v.title}
                </p>
                <p className='mt-1 text-xs text-gray-500'>
                  {v.durationText} · {count(v.viewCount)} 次观看
                </p>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
export default function YouTubeWatchPage() {
  return (
    <PageLayout activePath='/youtube'>
      <Suspense fallback={<div className='p-10'>正在加载…</div>}>
        <WatchContent />
      </Suspense>
    </PageLayout>
  );
}
