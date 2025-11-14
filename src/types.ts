export interface UserConfig {
  slug: string;
  serverUrl: string;
  username: string;
  password?: string;
  token?: string;
  salt?: string;
  useTokenAuth?: boolean;
  refreshIntervalMs?: number;
  theme?: string;
  themeOptions?: ThemeOptions;
}

export interface AppConfig {
  clientName: string;
  apiVersion: string;
  refreshIntervalMs?: number;
  defaultTheme?: string;
  listen?: ListenConfig;
  users: UserConfig[];
}

export type ThemeShadowStyle = 'none' | 'macos';

export interface ThemeOptions {
  shadowStyle?: ThemeShadowStyle;
}

export interface ListenConfig {
  host?: string;
  port?: number;
}

export interface NowPlayingEntry {
  id: string;
  title?: string;
  album?: string;
  artist?: string;
  duration?: number;
  coverArt?: string;
  username?: string;
  minutesAgo?: number;
  playerName?: string;
  created?: string;
  ['@attr']?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface NowPlayingResponseBody {
  'subsonic-response': {
    status: string;
    nowPlaying?: {
      entry?: NowPlayingEntry | NowPlayingEntry[];
    };
    error?: {
      code: number;
      message: string;
    };
  };
}
