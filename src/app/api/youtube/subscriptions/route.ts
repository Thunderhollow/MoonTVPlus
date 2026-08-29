/* eslint-disable @typescript-eslint/no-explicit-any */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export const runtime = 'nodejs';

interface SavedChannel {
  id: string;
  title: string;
  url: string;
}

async function database() {
  const { env } = getCloudflareContext() as any;
  if (!env?.DB) throw new Error('Cloudflare D1 binding DB is unavailable');
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS youtube_channels (
      username TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (username, channel_id)
    )`
  ).run();
  return env.DB;
}

function username(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  return auth?.username || '';
}

export async function GET(request: NextRequest) {
  const user = username(request);
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = await database();
    const result = await db
      .prepare(
        'SELECT channel_id, title, url FROM youtube_channels WHERE username = ? ORDER BY position ASC, updated_at DESC'
      )
      .bind(user)
      .all();
    const channels = (result.results || []).map((row: any) => ({
      id: row.channel_id,
      title: row.title,
      url: row.url,
    }));
    return NextResponse.json({ channels });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '读取频道订阅失败' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const user = username(request);
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const channels: SavedChannel[] = Array.isArray(body.channels)
      ? body.channels.slice(0, 200)
      : [];
    if (
      channels.some(
        (item) =>
          !item ||
          !/^UC[\w-]{20,}$/.test(item.id) ||
          typeof item.title !== 'string' ||
          typeof item.url !== 'string'
      )
    ) {
      return NextResponse.json(
        { error: '频道资料格式不正确' },
        { status: 400 }
      );
    }

    const db = await database();
    const now = Date.now();
    const statements = [
      db.prepare('DELETE FROM youtube_channels WHERE username = ?').bind(user),
      ...channels.map((channel, position) =>
        db
          .prepare(
            'INSERT INTO youtube_channels (username, channel_id, title, url, position, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .bind(
            user,
            channel.id,
            channel.title.slice(0, 200),
            channel.url.slice(0, 500),
            position,
            now
          )
      ),
    ];
    await db.batch(statements);
    return NextResponse.json({ success: true, channels });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存频道订阅失败' },
      { status: 500 }
    );
  }
}
