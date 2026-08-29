'use client';

import { Languages } from 'lucide-react';

import { useChineseLanguage } from './ChineseLanguageProvider';

export function ChineseLanguageToggle() {
  const { mode, toggleMode } = useChineseLanguage();
  const isTraditional = mode === 'traditional';

  return (
    <button
      type='button'
      onClick={toggleMode}
      className='flex h-10 min-w-10 items-center justify-center gap-1 rounded-full px-2 text-gray-600 transition-colors hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50'
      aria-label={isTraditional ? '切换到简体中文' : '切換到繁體中文'}
      title={isTraditional ? '切换到简体中文' : '切換到繁體中文'}
      data-no-chinese-convert
    >
      <Languages className='h-5 w-5' />
      <span className='text-xs font-semibold'>
        {isTraditional ? '繁' : '简'}
      </span>
    </button>
  );
}
