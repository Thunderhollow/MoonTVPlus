'use client';

import { Play, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useWatchTogether } from '@/hooks/useWatchTogether';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
}

export default function ContinueWatchingTogether() {
  const router = useRouter();
  const together = useWatchTogether();
  if (!together.enabled || !together.state) return null;
  const state = together.state;
  const progress = state.duration > 0 ? Math.min(100, state.position / state.duration * 100) : 0;
  return (
    <section className='mb-8'>
      <h2 className='mb-4 flex items-center gap-2 text-xl font-bold text-gray-800 dark:text-gray-200'>
        <Users className='h-5 w-5' /> Continue Watching Together
      </h2>
      <button
        type='button'
        onClick={() => router.push(state.route)}
        className='group flex w-full max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-900'
      >
        <div className='relative aspect-video w-52 shrink-0 bg-gray-200 dark:bg-gray-800'>
          {state.thumbnail && <img src={state.thumbnail} alt='' className='h-full w-full object-cover' />}
          <span className='absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100'>
            <Play className='h-9 w-9 fill-white text-white' />
          </span>
        </div>
        <div className='min-w-0 flex-1 p-4'>
          <p className='truncate font-semibold text-gray-900 dark:text-white'>{state.title}</p>
          {state.episode && <p className='mt-1 text-sm text-gray-500'>Episode {state.episode}</p>}
          <p className='mt-3 text-sm text-gray-500'>{formatTime(state.position)} / {formatTime(state.duration)}</p>
          <div className='mt-2 h-1.5 overflow-hidden rounded bg-gray-200 dark:bg-gray-700'>
            <div className='h-full bg-green-500' style={{ width: `${progress}%` }} />
          </div>
          <p className='mt-3 text-xs text-gray-500'>
            {together.presence.map((member) => `${member.online ? '●' : '○'} ${member.username}`).join('   ')}
          </p>
        </div>
      </button>
    </section>
  );
}
