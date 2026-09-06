'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';
import { watchTogetherSocketManager } from '@/lib/watch-together-socket';
import type { WatchTogetherAction } from '@/types/watch-together';

const CLIENT_ID_KEY = 'watch_together_client_id';
const EMPTY_SNAPSHOT = { connected: false, state: null, presence: [] };

function getClientId() {
  let value = localStorage.getItem(CLIENT_ID_KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, value);
  }
  return value;
}

export function useWatchTogether() {
  const room = useWatchRoomContextSafe();
  const config = room?.config;
  const enabled = Boolean(
    config?.watchTogetherEnabled &&
      config.watchTogetherToken &&
      config.watchTogetherWebSocketUrl
  );
  const snapshot = useSyncExternalStore(
    watchTogetherSocketManager.subscribe,
    watchTogetherSocketManager.getSnapshot,
    () => EMPTY_SNAPSHOT
  );
  const revisionRef = useRef(0);

  useEffect(() => {
    revisionRef.current = snapshot.state?.revision || 0;
  }, [snapshot.state?.revision]);

  useEffect(() => {
    if (!enabled || !config?.watchTogetherToken || !config.watchTogetherWebSocketUrl) return;
    watchTogetherSocketManager.connect(
      config.watchTogetherWebSocketUrl,
      config.watchTogetherToken
    );
  }, [enabled, config?.watchTogetherToken, config?.watchTogetherWebSocketUrl]);

  useEffect(() => {
    if (!enabled) return;
    fetch('/api/watch-together/state')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => watchTogetherSocketManager.hydrateState(data?.state || null))
      .catch(() => undefined);
  }, [enabled]);

  useEffect(() => {
    if (config?.watchTogetherToken) {
      watchTogetherSocketManager.updateToken(config.watchTogetherToken);
    }
  }, [config?.watchTogetherToken]);

  const send = useCallback(
    async (kind: WatchTogetherAction['kind'], input: WatchTogetherAction['state']) => {
      if (!enabled) return;
      const action: WatchTogetherAction = {
        actionId: crypto.randomUUID(),
        clientId: getClientId(),
        baseRevision: revisionRef.current,
        kind,
        state: input,
      };
      try {
        const state = await watchTogetherSocketManager.send(action);
        await fetch('/api/watch-together/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state),
          keepalive: true,
        });
      } catch {
        // Playback remains local while the socket reconnects.
      }
    },
    [enabled]
  );

  const configuredPresence = useMemo(
    () =>
      (config?.watchTogetherUsers || []).map((username) => {
        const active = snapshot.presence.find((item) => item.username === username);
        return active || { username, connections: 0, online: false };
      }),
    [snapshot.presence, config?.watchTogetherUsers]
  );

  return {
    enabled,
    connected: snapshot.connected,
    state: snapshot.state,
    presence: configuredPresence,
    send,
  };
}
