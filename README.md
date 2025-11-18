# Disclaimer

Everything except this disclaimer is authored by GPT5-Codex in GitHub Copilot. Expect AI-ish code style and documentation.

# Showcase

![showcase](images/showcase.png)

# Subsonic Now Playing Overlay

A lightweight Node.js + TypeScript web application that renders a browser overlay for the current playback status of multiple Subsonic/OpenSubsonic users. Each user is configured statically via JSON and receives their own shareable overlay URL.

## Features

- Multi-user support with per-user overlay routes (`/overlay/<slug>`)
- Periodic polling of `getNowPlaying` with filtering by configured username
- Album art proxying to avoid exposing credentials to the browser
- Auto-scrolling text blocks for long titles and artist/album names
- Optional per-user refresh interval overrides (fallback to global default)
- Per-user theming with built-in `vanilla` and `fancy` themes, including customizable track transition animations

## Getting Started

### 1. Install dependencies

```powershell
npm install
```

### 2. Configure users

Duplicate `config/users.json` or create `config/users.local.json` (and point `CONFIG_PATH` to it). Each user entry looks like:

```json
{
  "clientName": "SubsonicNowPlayingOverlay",
  "apiVersion": "1.16.1",
  "refreshIntervalMs": 5000,
  "defaultTheme": "vanilla",
  "listen": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "users": [
    {
      "slug": "streamer-1",
      "serverUrl": "https://your.subsonic.server",
      "username": "alice",
      "password": "superSecretPassword",
      "useTokenAuth": true,
      "refreshIntervalMs": 4000,
      "theme": "fancy"
    }
  ]
}
```

> **Security tip:** Prefer `useTokenAuth: true` so requests use salted token authentication. Stored secrets should not be committed.

Secrets can also be supplied from external files instead of being embedded directly in the JSON:

- `passwordFile` – path to a file that contains the user's plain-text password (trailing newlines are stripped). Useful when pairing with `useTokenAuth: true`.
- `tokenFile` – path to a file containing a pre-generated Subsonic token.
- `saltFile` – optional path for the token's companion salt. When omitted, specify `salt` inline.

Relative paths are resolved from the configuration file's directory.

### 3. Run in development mode

```powershell
npm run dev
```

The development server binds to the `listen` host/port defined in the config (default `0.0.0.0:3000`). Open `http://<host>:<port>/overlay/<slug>`—replacing with your configured values and user slug—to view the overlay.

### 4. Build for production

```powershell
npm run build
npm start
```

The compiled JavaScript lives in `dist/` and can be hosted behind any process manager or reverse proxy.

## Themes

- Theme stylesheets live in `public/themes`. Each file defines CSS variables to color the overlay and custom transition animations when a track changes.
- Set a global default via `defaultTheme` in the config, or override per user with the `theme` field.
- Include a new theme by adding a stylesheet (e.g. `public/themes/retro.css`) and referencing it by slug in the configuration.
- Theme slugs are case-insensitive but should map to the stylesheet filename (letters, numbers, and hyphens only).

## Environment Variables

- `PORT` or `LISTEN_PORT` – override the configured listen port
- `HOST` or `LISTEN_HOST` – override the configured listen host
- `CONFIG_PATH` – absolute or relative path to the configuration JSON file (defaults to `config/users.json`)

## Testing the Overlay

Because `getNowPlaying` only reports active streams, run a track in the Subsonic-compatible client for each configured user. The overlay refresh interval defaults to the root `refreshIntervalMs` field but can be overridden per user when needed.

## Limitations

- Subsonic/OpenSubsonic do not expose per-track progress via `getNowPlaying`, so lyric display and other sync-to-progress features are intentionally omitted.

## Project Scripts

- `npm run dev` – start the Express server with live reload (ts-node-dev)
- `npm run build` – type-check and compile TypeScript to `dist/`
- `npm run start` – run the compiled server
- `npm run lint` – lint the TypeScript sources with ESLint

## License

This project is provided without a specific license. Add one before distributing.
