const SESSION_NAME = 'default';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verifyToken(token, env) {
  if (!token || !env.WATCH_TOGETHER_TOKEN_SECRET) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.WATCH_TOGETHER_TOKEN_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(signature),
      new TextEncoder().encode(payload)
    );
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    const users = (env.WATCH_TOGETHER_USERS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 2);
    if (!users.includes(claims.username) || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export class WatchTogetherSession {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.state = null;
    this.revision = 0;
    this.ready = this.ctx.blockConcurrencyWhile(async () => {
      this.state = (await this.ctx.storage.get('state')) || null;
      this.revision = this.state?.revision || 0;
    });
  }

  async fetch(request) {
    await this.ready;
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return json({ error: 'Expected WebSocket upgrade' }, 426);
    }
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = (this.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (allowedOrigins.length && !allowedOrigins.includes(origin)) {
      return json({ error: 'Origin not allowed' }, 403);
    }
    const claims = await verifyToken(new URL(request.url).searchParams.get('token'), this.env);
    if (!claims) return json({ error: 'Unauthorized' }, 401);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      username: claims.username,
      connectedAt: Date.now(),
    });
    server.send(JSON.stringify({ type: 'state', state: this.state }));
    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, raw) {
    if (typeof raw !== 'string' || raw.length > 65536) return;
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (message.type === 'ping') {
      socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      return;
    }
    if (message.type !== 'action') return;
    const identity = socket.deserializeAttachment();
    const action = message.action;
    if (
      !identity?.username ||
      !action?.actionId ||
      !action?.state?.contentId ||
      !action.state.route?.startsWith('/')
    ) return;

    this.revision = Math.max(this.revision, Number(action.baseRevision) || 0) + 1;
    this.state = {
      ...action.state,
      sessionId: SESSION_NAME,
      revision: this.revision,
      actionId: action.actionId,
      actorUsername: identity.username,
      serverUpdatedAt: Date.now(),
    };
    await this.ctx.storage.put('state', this.state);
    const stateMessage = JSON.stringify({ type: 'state', state: this.state });
    for (const peer of this.ctx.getWebSockets()) {
      if (peer !== socket) this.safeSend(peer, stateMessage);
    }
    this.safeSend(socket, JSON.stringify({ type: 'ack', actionId: action.actionId, state: this.state }));
  }

  webSocketClose() {
    this.broadcastPresence();
  }

  webSocketError() {
    this.broadcastPresence();
  }

  broadcastPresence() {
    const counts = new Map();
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment();
      if (attachment?.username) {
        counts.set(attachment.username, (counts.get(attachment.username) || 0) + 1);
      }
    }
    const presence = Array.from(counts, ([username, connections]) => ({
      username,
      connections,
      online: true,
    }));
    const message = JSON.stringify({ type: 'presence', presence });
    for (const socket of this.ctx.getWebSockets()) this.safeSend(socket, message);
  }

  safeSend(socket, message) {
    try { socket.send(message); } catch { /* disconnected */ }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true });
    if (url.pathname !== '/ws') return json({ error: 'Not found' }, 404);
    if (env.WATCH_TOGETHER_ENABLED !== 'true') return json({ error: 'Disabled' }, 404);
    const stub = env.WATCH_TOGETHER_SESSION.getByName(SESSION_NAME);
    return stub.fetch(request);
  },
};
