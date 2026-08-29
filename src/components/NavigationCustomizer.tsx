'use client';

import type { LucideIcon } from 'lucide-react';
import { Eye, EyeOff, Settings2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export interface CustomizableNavigationItem {
  icon: LucideIcon;
  label: string;
  href: string;
}
interface Preferences {
  order: string[];
  hidden: string[];
}
const KEY = 'moontv-navigation-preferences',
  EVENT = 'moontvNavigationPreferencesUpdated';
const defaults: Preferences = { order: [], hidden: [] };
let cloudLoad: Promise<void> | null = null;
function read(): Preferences {
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      order: Array.isArray(x.order) ? x.order : [],
      hidden: Array.isArray(x.hidden) ? x.hidden : [],
    };
  } catch {
    return defaults;
  }
}
function arrange(items: CustomizableNavigationItem[], p: Preferences) {
  const rank = new Map(p.order.map((x, i) => [x, i]));
  return [...items].sort(
    (a, b) => (rank.get(a.href) ?? 9999) - (rank.get(b.href) ?? 9999)
  );
}
function writeLocal(preferences: Preferences) {
  localStorage.setItem(KEY, JSON.stringify(preferences));
  window.dispatchEvent(new Event(EVENT));
}
async function saveCloud(preferences: Preferences) {
  const response = await fetch('/api/navigation/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences }),
  });
  if (!response.ok) throw new Error('云端同步失败');
}
function loadCloud() {
  if (cloudLoad) return cloudLoad;
  cloudLoad = fetch('/api/navigation/preferences')
    .then(async (response) => {
      if (!response.ok) throw new Error('云端同步不可用');
      const result = await response.json();
      if (result.preferences) writeLocal(result.preferences);
      else {
        const local = read();
        if (local.order.length || local.hidden.length) await saveCloud(local);
      }
    })
    .catch(() => undefined);
  return cloudLoad;
}
export function useVisibleNavigationItems(items: CustomizableNavigationItem[]) {
  const [p, setP] = useState(defaults);
  useEffect(() => {
    const update = () => setP(read());
    update();
    void loadCloud();
    window.addEventListener(EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return useMemo(
    () => arrange(items, p).filter((x) => !p.hidden.includes(x.href)),
    [items, p]
  );
}
export function NavigationCustomizer({
  items,
  collapsed = false,
  mobile = false,
}: {
  items: CustomizableNavigationItem[];
  collapsed?: boolean;
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [p, setP] = useState(defaults),
    [syncStatus, setSyncStatus] = useState('');
  const list = useMemo(() => arrange(items, p), [items, p]);
  const save = (next: Preferences) => {
    setP(next);
    writeLocal(next);
    setSyncStatus('正在同步…');
    void saveCloud(next)
      .then(() => setSyncStatus('已同步到云端'))
      .catch(() => setSyncStatus('同步失败，设置仅保存在此设备'));
  };
  const move = (href: string, offset: number) => {
    const order = list.map((x) => x.href),
      i = order.indexOf(href),
      target = i + offset;
    if (target < 0 || target >= order.length) return;
    [order[i], order[target]] = [order[target], order[i]];
    save({ ...p, order });
  };
  const toggle = (href: string) =>
    save({
      ...p,
      hidden: p.hidden.includes(href)
        ? p.hidden.filter((x) => x !== href)
        : [...p.hidden, href],
    });
  return (
    <>
      <button
        type='button'
        onClick={() => {
          setP(read());
          setOpen(true);
        }}
        title='自定义导航'
        className={
          mobile
            ? 'flex h-14 w-full flex-col items-center justify-center gap-1 text-xs text-gray-500'
            : 'flex min-h-[40px] w-full items-center gap-3 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100/50 dark:text-gray-300 dark:hover:bg-gray-700/50'
        }
      >
        <Settings2 className={mobile ? 'h-6 w-6' : 'h-4 w-4'} />
        {(!collapsed || mobile) && (
          <span>{mobile ? '导航设置' : '自定义导航'}</span>
        )}
      </button>
      {open &&
        createPortal(
          <div
            className='fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4'
            onClick={() => setOpen(false)}
          >
            <div
              className='w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='mb-4 flex items-center justify-between'>
                <div>
                  <h2 className='text-lg font-bold dark:text-white'>
                    自定义导航
                  </h2>
                  <p className='text-sm text-gray-500'>调整顺序或隐藏入口</p>
                  {syncStatus && (
                    <p className='mt-1 text-xs text-green-600'>{syncStatus}</p>
                  )}
                </div>
                <button onClick={() => setOpen(false)}>
                  <X />
                </button>
              </div>
              <div className='max-h-[65vh] space-y-2 overflow-y-auto'>
                {list.map((item, i) => {
                  const hidden = p.hidden.includes(item.href),
                    Icon = item.icon;
                  return (
                    <div
                      key={item.href}
                      className={`flex items-center gap-2 rounded-xl border p-2 dark:border-gray-700 ${
                        hidden ? 'opacity-50' : ''
                      }`}
                    >
                      <Icon className='h-5 w-5' />
                      <span className='min-w-0 flex-1 truncate text-sm'>
                        {item.label}
                      </span>
                      <button
                        disabled={!i}
                        onClick={() => move(item.href, -1)}
                        className='p-2 disabled:opacity-20'
                      >
                        ↑
                      </button>
                      <button
                        disabled={i === list.length - 1}
                        onClick={() => move(item.href, 1)}
                        className='p-2 disabled:opacity-20'
                      >
                        ↓
                      </button>
                      <button onClick={() => toggle(item.href)} className='p-2'>
                        {hidden ? (
                          <EyeOff className='h-4 w-4' />
                        ) : (
                          <Eye className='h-4 w-4' />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => save(defaults)}
                className='mt-4 w-full rounded-xl border py-2.5 dark:border-gray-700'
              >
                恢复默认排列
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
