'use client';

import { useChineseLanguage } from './ChineseLanguageProvider';

export function ChineseLanguageToggle() {
  const { mode, toggleMode } = useChineseLanguage();
  const isTraditional = mode === 'traditional';

  return (
    <button
      type='button'
      onClick={toggleMode}
      className='flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-gray-600 transition-colors hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50'
      aria-label={isTraditional ? '切换到简体中文' : '切換到繁體中文'}
      title={isTraditional ? '切换到简体中文' : '切換到繁體中文'}
      data-no-chinese-convert
    >
      <span className='text-sm font-semibold'>
        {isTraditional ? '繁' : '簡'}
      </span>
    </button>
  );
}
