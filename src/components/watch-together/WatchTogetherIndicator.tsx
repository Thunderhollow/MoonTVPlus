'use client';

import { Users } from 'lucide-react';
import { useState } from 'react';

import { useWatchTogether } from '@/hooks/useWatchTogether';

export default function WatchTogetherIndicator() {
  const together = useWatchTogether();
  const [open, setOpen] = useState(false);
  if (!together.enabled) return null;
  const online = together.presence.filter((member) => member.online).length;
  return (
    <div className='fixed right-4 top-20 z-[700]'>
      <button
        type='button'
        onClick={() => setOpen((value) => !value)}
        className='flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-md'
        aria-expanded={open}
      >
        <Users className='h-4 w-4' />
        {online >= 2 ? 'Both watching' : online === 1 ? 'Only you' : 'Reconnecting'}
      </button>
      {open && (
        <div className='mt-2 w-56 rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-white'>
          <p className='mb-3 font-semibold'>Watch Together</p>
          <div className='space-y-2'>
            {together.presence.map((member) => (
              <div key={member.username} className='flex items-center justify-between gap-3'>
                <span className='truncate'>{member.username}</span>
                <span className={member.online ? 'text-green-500' : 'text-gray-400'}>
                  ● {member.online ? 'Online' : 'Offline'}
                </span>
              </div>
            ))}
          </div>
          <p className='mt-3 border-t border-gray-200 pt-3 text-xs text-gray-500 dark:border-gray-700'>
            {together.connected ? 'Sync connected · Both can control' : 'Local playback continues while reconnecting'}
          </p>
        </div>
      )}
    </div>
  );
}
