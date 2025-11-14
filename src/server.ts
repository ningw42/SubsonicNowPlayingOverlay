import cors from 'cors';
import express, { Request, Response } from 'express';
import path from 'path';
import { Readable } from 'stream';
import { ReadableStream as NodeReadableStream } from 'stream/web';
import { getConfig, getListenConfig, getRefreshIntervalMs, getTheme, getThemeOptions, getUserConfig } from './config';
import { getNowPlayingEntry, proxyCoverArt } from './subsonicClient';

const app = express();
const config = getConfig();
const listenConfig = getListenConfig();
const envHost = process.env.HOST ?? process.env.LISTEN_HOST;
const envPort = process.env.PORT ?? process.env.LISTEN_PORT;

const portCandidate = Number(envPort ?? listenConfig.port);
const port = Number.isFinite(portCandidate) && portCandidate > 0 && portCandidate < 65536 ? portCandidate : listenConfig.port;
const host = typeof envHost === 'string' && envHost.trim().length > 0 ? envHost.trim() : listenConfig.host;

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const indexHtmlPath = path.join(publicDir, 'index.html');

app.use(cors());
app.use('/static', express.static(publicDir));
app.use('/assets', express.static(publicDir));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/api/users/:slug/now-playing', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = getUserConfig(slug);
  if (!user) {
    res.status(404).json({ message: `Unknown user slug: ${slug}` });
    return;
  }

  try {
    const entry = await getNowPlayingEntry(user);

    if (!entry) {
      res.json({
        playing: false,
        refreshIntervalMs: getRefreshIntervalMs(user),
        fetchedAt: Date.now(),
        theme: getTheme(user),
        themeOptions: getThemeOptions(user),
      });
      return;
    }

    res.json({
      playing: true,
      refreshIntervalMs: getRefreshIntervalMs(user),
      fetchedAt: Date.now(),
      theme: getTheme(user),
      themeOptions: getThemeOptions(user),
      track: {
        id: entry.id,
        title: entry.title ?? null,
        album: entry.album ?? null,
        artist: entry.artist ?? null,
      },
      coverArt: entry.coverArt
        ? {
            id: entry.coverArt,
            url: `/api/users/${slug}/cover-art/${encodeURIComponent(entry.coverArt)}`,
          }
        : null,
    });
  } catch (error) {
    console.error(`Failed to retrieve now playing for ${slug}:`, error);
    res.status(502).json({
      message: error instanceof Error ? error.message : 'Unknown error fetching now playing data',
    });
  }
});

app.get('/api/users/:slug/cover-art/:coverId', async (req: Request, res: Response) => {
  const { slug, coverId } = req.params;
  const user = getUserConfig(slug);
  if (!user) {
    res.status(404).json({ message: `Unknown user slug: ${slug}` });
    return;
  }

  try {
    const upstream = await proxyCoverArt(user, coverId);
    upstream.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (upstream.body) {
      const webStream = upstream.body as unknown as NodeReadableStream<Uint8Array>;
      const nodeStream = Readable.fromWeb(webStream);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error(`Failed to proxy cover art for ${slug}:`, error);
    res.status(502).json({ message: 'Unable to load cover art' });
  }
});

app.get('/overlay/:slug', (_req: Request, res: Response) => {
  res.sendFile(indexHtmlPath);
});

app.get('/', (_req: Request, res: Response) => {
  const defaultSlug = config.users[0]?.slug ?? 'demo';
  res.redirect(`/overlay/${defaultSlug}`);
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: 'Not found' });
});

app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
