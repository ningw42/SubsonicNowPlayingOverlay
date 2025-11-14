import crypto from 'crypto';
import { URL } from 'url';
import { getConfig } from './config';
import { NowPlayingEntry, NowPlayingResponseBody, UserConfig } from './types';

const JSON_HEADERS = {
  Accept: 'application/json',
};

function randomSalt(length = 12): string {
  return crypto.randomBytes(length).toString('hex');
}

function md5(value: string): string {
  return crypto.createHash('md5').update(value).digest('hex');
}

function buildAuthParams(user: UserConfig): URLSearchParams {
  const { clientName, apiVersion } = getConfig();
  const params = new URLSearchParams({
    u: user.username,
    v: apiVersion,
    c: clientName,
    f: 'json',
  });

  if (user.useTokenAuth) {
    if (!user.password) {
      throw new Error(`User ${user.slug} is configured for token auth but no password was provided.`);
    }
    const salt = randomSalt();
    params.set('t', md5(user.password + salt));
    params.set('s', salt);
  } else if (user.token && user.salt) {
    params.set('t', user.token);
    params.set('s', user.salt);
  } else if (user.password) {
    params.set('p', user.password);
  } else {
    throw new Error(`No valid authentication credentials found for user ${user.slug}.`);
  }

  return params;
}

function buildUrl(user: UserConfig, endpoint: string, query: Record<string, string> = {}): string {
  const url = new URL(endpoint, user.serverUrl);
  const params = buildAuthParams(user);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      params.set(key, value);
    }
  }
  url.search = params.toString();
  return url.toString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: JSON_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function getNowPlayingEntry(user: UserConfig): Promise<NowPlayingEntry | null> {
  const url = buildUrl(user, '/rest/getNowPlaying.view');
  const payload = await fetchJson<NowPlayingResponseBody>(url);
  const body = payload['subsonic-response'];

  if (body.status !== 'ok') {
    const message = body.error?.message ?? 'Unknown error';
    throw new Error(`Subsonic getNowPlaying failed: ${message}`);
  }

  const entries = body.nowPlaying?.entry;
  if (!entries) {
    return null;
  }

  const normalized = Array.isArray(entries) ? entries : [entries];
  const match = normalized
    .filter((entry) => entry.username === user.username)
    .sort((a, b) => (a.minutesAgo ?? 0) - (b.minutesAgo ?? 0))[0];

  return match ?? null;
}

export async function proxyCoverArt(user: UserConfig, coverArtId: string): Promise<Response> {
  const url = buildUrl(user, '/rest/getCoverArt.view', { id: coverArtId, size: '500' });
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download cover art: ${response.status} ${response.statusText}`);
  }

  return response;
}
