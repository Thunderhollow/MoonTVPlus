export type WatchTogetherContentType = 'movie' | 'tv' | 'youtube';

export interface WatchTogetherState {
  sessionId: 'default';
  revision: number;
  actionId: string;
  actorUsername: string;
  contentType: WatchTogetherContentType;
  contentId: string;
  title: string;
  thumbnail?: string;
  route: string;
  source?: string;
  sourceName?: string;
  season?: number;
  episode?: number;
  position: number;
  duration: number;
  paused: boolean;
  playbackRate: number;
  mediaUpdatedAt: number;
  serverUpdatedAt: number;
}

export interface WatchTogetherAction {
  actionId: string;
  clientId: string;
  baseRevision: number;
  kind: 'state' | 'play' | 'pause' | 'seek' | 'content-change';
  state: Omit<WatchTogetherState, 'sessionId' | 'revision' | 'actionId' | 'actorUsername' | 'serverUpdatedAt'>;
}

export interface WatchTogetherPresence {
  username: string;
  connections: number;
  online: boolean;
}

export interface WatchTogetherConfig {
  enabled: boolean;
  users: string[];
}

export interface WatchTogetherHistoryItem extends WatchTogetherState {
  historyUpdatedAt: number;
}
