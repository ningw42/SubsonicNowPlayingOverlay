import fs from 'fs';
import path from 'path';
import { AppConfig, ListenConfig, ThemeOptions, ThemeShadowStyle, UserConfig } from './types';

const CONFIG_PATH = process.env.CONFIG_PATH
  ? path.resolve(process.cwd(), process.env.CONFIG_PATH)
  : path.resolve(process.cwd(), 'config', 'users.json');

const DEFAULT_THEME = 'vanilla';
const THEME_NAME_PATTERN = /^[a-z0-9-]+$/i;
const DEFAULT_THEME_OPTIONS: ThemeOptions = {
  shadowStyle: 'none',
};
const ALLOWED_SHADOW_STYLES: readonly ThemeShadowStyle[] = ['none', 'macos'];
const DEFAULT_LISTEN_HOST = '0.0.0.0';
const DEFAULT_LISTEN_PORT = 3000;

function readConfigFile(): AppConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Missing configuration file. Expected at ${CONFIG_PATH}`);
  }

  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as AppConfig;

  if (!parsed.users || !Array.isArray(parsed.users) || parsed.users.length === 0) {
    throw new Error('Configuration must include at least one user in the "users" array.');
  }

  return parsed;
}

const config: AppConfig = readConfigFile();

export function getConfig(): AppConfig {
  return config;
}

export function getUserConfig(slug: string): UserConfig | undefined {
  return config.users.find((user) => user.slug === slug);
}

export function getRefreshIntervalMs(user?: UserConfig): number {
  const override = user?.refreshIntervalMs;
  if (typeof override === 'number' && override > 0) {
    return override;
  }

  return config.refreshIntervalMs ?? 5000;
}

function normalizeTheme(theme?: string): string | undefined {
  if (!theme) {
    return undefined;
  }

  const trimmed = theme.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }

  if (!THEME_NAME_PATTERN.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

export function getTheme(user?: UserConfig): string {
  const userTheme = normalizeTheme(user?.theme);
  if (userTheme) {
    return userTheme;
  }

  const defaultTheme = normalizeTheme(config.defaultTheme);
  if (defaultTheme) {
    return defaultTheme;
  }

  return DEFAULT_THEME;
}

function normalizeListenConfig(listen?: ListenConfig): { host: string; port: number } {
  const host = typeof listen?.host === 'string' && listen.host.trim().length > 0 ? listen.host.trim() : DEFAULT_LISTEN_HOST;

  if (typeof listen?.port === 'number') {
    const normalizedPort = Math.floor(listen.port);
    if (Number.isFinite(normalizedPort) && normalizedPort > 0 && normalizedPort < 65536) {
      return { host, port: normalizedPort };
    }
  }

  return { host, port: DEFAULT_LISTEN_PORT };
}

export function getListenConfig(): { host: string; port: number } {
  return normalizeListenConfig(config.listen);
}

function normalizeThemeOptions(options?: ThemeOptions): Partial<ThemeOptions> {
  if (!options || typeof options !== 'object') {
    return {};
  }

  const normalized: Partial<ThemeOptions> = {};

  if (options.shadowStyle) {
    const candidate = options.shadowStyle.toLowerCase() as ThemeShadowStyle;
    if (ALLOWED_SHADOW_STYLES.includes(candidate)) {
      normalized.shadowStyle = candidate;
    }
  }

  return normalized;
}

export function getThemeOptions(user?: UserConfig): ThemeOptions {
  const normalized = normalizeThemeOptions(user?.themeOptions);
  return {
    ...DEFAULT_THEME_OPTIONS,
    ...normalized,
  };
}
