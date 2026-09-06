'use client';

import type { WatchTogetherAction, WatchTogetherPresence, WatchTogetherState } from '@/types/watch-together';

interface Snapshot {
  connected: boolean;
  state: WatchTogetherState | null;
  presence: WatchTogetherPresence[];
}

type Listener = () => void;
type PendingAction = { resolve: (state: WatchTogetherState) => void; reject: (error: Error) => void };

class WatchTogetherSocketManager {
  private socket: WebSocket | null = null;
  private url = '';
  private token = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private listeners = new Set<Listener>();
  private pending = new Map<string, PendingAction>();
  private snapshot: Snapshot = { connected: false, state: null, presence: [] };

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  connect(url: string, token: string) {
    this.url = url;
    this.token = token;
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;
    const endpoint = new URL(url);
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : endpoint.protocol === 'http:' ? 'ws:' : endpoint.protocol;
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/ws`;
    endpoint.searchParams.set('token', token);
    const socket = new WebSocket(endpoint.toString());
    this.socket = socket;
    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.update({ connected: true });
    };
    socket.onmessage = (event) => this.handleMessage(String(event.data));
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.update({ connected: false, presence: [] });
      this.scheduleReconnect();
    };
  }

  updateToken(token: string) {
    this.token = token;
  }

  hydrateState(state: WatchTogetherState | null) {
    if (!state) return;
    if (!this.snapshot.state || state.revision > this.snapshot.state.revision) {
      this.update({ state });
    }
  }

  async send(action: WatchTogetherAction): Promise<WatchTogetherState> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error('Watch Together is offline');
    return new Promise((resolve, reject) => {
      this.pending.set(action.actionId, { resolve, reject });
      this.socket!.send(JSON.stringify({ type: 'action', action }));
      setTimeout(() => {
        const pending = this.pending.get(action.actionId);
        if (!pending) return;
        this.pending.delete(action.actionId);
        pending.reject(new Error('Watch Together action timed out'));
      }, 10000);
    });
  }

  private handleMessage(raw: string) {
    let message: any;
    try { message = JSON.parse(raw); } catch { return; }
    if (message.type === 'state' && message.state) this.update({ state: message.state });
    if (message.type === 'presence') this.update({ presence: message.presence || [] });
    if (message.type === 'ack' && message.state) {
      this.update({ state: message.state });
      const pending = this.pending.get(message.actionId);
      if (pending) {
        this.pending.delete(message.actionId);
        pending.resolve(message.state);
      }
    }
  }

  private update(next: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach((listener) => listener());
  }

  private scheduleReconnect() {
    if (!this.url || !this.token || this.reconnectTimer) return;
    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempt++);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.url, this.token);
    }, delay);
  }
}

export const watchTogetherSocketManager = new WatchTogetherSocketManager();
