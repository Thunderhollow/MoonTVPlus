/* eslint-disable @typescript-eslint/no-explicit-any */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export const runtime = 'nodejs';

interface Preferences {
  order: string[];
  hidden: string[];
}

async function database() {
  const { env } = getCloudflareContext() as any;
  if (!env?.DB) throw new Error('Cloudflare D1 binding DB is unavailable');
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS user_navigation_preferences (
    username TEXT PRIMARY KEY,
    preferences_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`
  ).run();
  return env.DB;
}

function username(request: NextRequest) {
  return getAuthInfoFromCookie(request)?.username || '';
}

function valid(value: any): value is Preferences {
  return Boolean(
    value &&
      Array.isArray(value.order) &&
      Array.isArray(value.hidden) &&
      value.order.length <= 100 &&
      value.hidden.length <= 100 &&
      [...value.order, ...value.hidden].every(
        (item) => typeof item === 'string' && item.length <= 300
      )
  );
}

export async function GET(request: NextRequest) {
  const user = username(request);
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = await database();
    const row = await db
      .prepare(
        'SELECT preferences_json FROM user_navigation_preferences WHERE username = ?'
      )
      .bind(user)
      .first();
    return NextResponse.json({
      preferences: row ? JSON.parse(row.preferences_json) : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '读取导航设置失败' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const user = username(request);
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const preferences = (await request.json()).preferences;
    if (!valid(preferences))
      return NextResponse.json(
        { error: '导航设置格式不正确' },
        { status: 400 }
      );
    const db = await database();
    await db
      .prepare(
        `INSERT INTO user_navigation_preferences (username, preferences_json, updated_at)
        VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET
        preferences_json = excluded.preferences_json, updated_at = excluded.updated_at`
      )
      .bind(user, JSON.stringify(preferences), Date.now())
      .run();
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存导航设置失败' },
      { status: 500 }
    );
  }
}
