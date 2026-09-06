import { db } from './db';
import type { WatchTogetherHistoryItem, WatchTogetherState } from '@/types/watch-together';

const STATE_KEY = 'watch-together:state';
const HISTORY_KEY = 'watch-together:history';
const HISTORY_LIMIT = 50;

export async function getWatchTogetherState(): Promise<WatchTogetherState | null> {
  const value = await db.getGlobalValue(STATE_KEY);
  return value ? (JSON.parse(value) as WatchTogetherState) : null;
}

export async function saveWatchTogetherState(next: WatchTogetherState): Promise<WatchTogetherState> {
  const current = await getWatchTogetherState();
  if (current && next.revision <= current.revision) return current;
  await db.setGlobalValue(STATE_KEY, JSON.stringify(next));
  await updateHistory(next);
  return next;
}

export async function getWatchTogetherHistory(): Promise<WatchTogetherHistoryItem[]> {
  const value = await db.getGlobalValue(HISTORY_KEY);
  return value ? (JSON.parse(value) as WatchTogetherHistoryItem[]) : [];
}

async function updateHistory(state: WatchTogetherState) {
  const history = await getWatchTogetherHistory();
  const identity = `${state.contentType}:${state.contentId}:${state.season || 0}:${state.episode || 0}`;
  const next = history.filter((item) =>
    `${item.contentType}:${item.contentId}:${item.season || 0}:${item.episode || 0}` !== identity
  );
  next.unshift({ ...state, historyUpdatedAt: Date.now() });
  await db.setGlobalValue(HISTORY_KEY, JSON.stringify(next.slice(0, HISTORY_LIMIT)));
}
