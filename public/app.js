const titleEl = document.getElementById('title');
const artistEl = document.getElementById('artist');
const albumEl = document.getElementById('album');
const coverEl = document.getElementById('cover');
const overlayEl = document.querySelector('.overlay');
const themeLink = document.getElementById('theme-style');

const DEFAULT_REFRESH_MS = 5000;
const DEFAULT_THEME = 'vanilla';
const THEME_BASE_PATH = '/static/themes/';
let refreshHandle;
const textScrollAnimations = new Map();
const TEXT_SCROLL_SPEED = 0.6;
const TEXT_SCROLL_RESET_DELAY = 5000;
const TEXT_SCROLL_RESET_ANIMATION_MS = 500;
let currentTrackSignature = null;
let currentTheme = DEFAULT_THEME;
const DEFAULT_THEME_OPTIONS = { shadowStyle: 'none' };
let currentThemeOptions = { ...DEFAULT_THEME_OPTIONS };
const FANCY_BASE_RGB = [18, 14, 40];
const FANCY_BLEND_RATIO = 0.68;
const FANCY_MIN_LUMA = 55;
const FANCY_MAX_LUMA = 140;
const fancyCanvasSize = 48;
const fancyColorCanvas = document.createElement('canvas');
fancyColorCanvas.width = fancyCanvasSize;
fancyColorCanvas.height = fancyCanvasSize;
const fancyColorCtx = fancyColorCanvas.getContext('2d', { willReadFrequently: true });

if (document.body) {
  document.body.dataset.theme = document.body.dataset.theme || DEFAULT_THEME;
}

if (themeLink) {
  themeLink.addEventListener('error', () => {
    if (currentTheme !== DEFAULT_THEME) {
      currentTheme = DEFAULT_THEME;
      themeLink.setAttribute('href', `${THEME_BASE_PATH}${DEFAULT_THEME}.css`);
      if (document.body) {
        document.body.dataset.theme = DEFAULT_THEME;
      }
    }
  });
}

if (overlayEl) {
  const clearTransitionClass = () => {
    overlayEl.classList.remove('transitioning');
  };
  overlayEl.addEventListener('animationend', clearTransitionClass);
  overlayEl.addEventListener('transitionend', clearTransitionClass);
}

if (coverEl) {
  coverEl.addEventListener('load', () => applyFancyDynamicPalette(true));
  coverEl.addEventListener('error', () => clearFancyDynamicStyling());
}

function getSlugFromPath() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? null;
}

const userSlug = getSlugFromPath();

if (!userSlug) {
  console.error('Missing user slug in URL.');
}

function wrapScrollableContent(element, text) {
  const existing = element.querySelector('span');
  const nextText = text ?? '';

  if (existing) {
    const isSame = existing.textContent === nextText;
    if (isSame) {
      // Keep existing animation state if nothing changed.
      return;
    }
  }

  stopTextAutoScroll(element);
  element.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = nextText;
  element.appendChild(span);
  requestAnimationFrame(() => evaluateTextOverflow(element));
}

function evaluateTextOverflow(element) {
  if (!element) return;
  const span = element.querySelector('span');
  if (!span) return;

  const overflow = span.scrollWidth - element.clientWidth;
  if (overflow > 4) {
    element.classList.add('scroll-active');
    startTextAutoScroll(element, span, overflow);
  } else {
    element.classList.remove('scroll-active');
    stopTextAutoScroll(element);
  }
}

function stopTextAutoScroll(element) {
  const state = textScrollAnimations.get(element);
  if (!state) {
    return;
  }

  if (state.frameId) {
    cancelAnimationFrame(state.frameId);
  }

  if (state.timeoutId) {
    clearTimeout(state.timeoutId);
  }

  if (state.transitionTimeoutId) {
    clearTimeout(state.transitionTimeoutId);
  }

  if (state.span) {
    if (state.resetHandler) {
      state.span.removeEventListener('transitionend', state.resetHandler);
    }
    state.span.style.transition = 'none';
    state.span.style.transform = '';
  }

  textScrollAnimations.delete(element);
}

function startTextAutoScroll(element, span, overflow) {
  stopTextAutoScroll(element);
  if (overflow <= 0) {
    return;
  }

  const state = {
    frameId: 0,
    timeoutId: 0,
    span,
    transitionTimeoutId: 0,
    resetHandler: null,
  };
  let offset = 0;

  const tick = () => {
    offset += TEXT_SCROLL_SPEED;

    if (offset >= overflow) {
      span.style.transition = 'none';
      span.style.transform = `translateX(${-overflow}px)`;
      offset = 0;

      const onTransitionEnd = () => {
        if (state.resetHandler) {
          span.removeEventListener('transitionend', state.resetHandler);
          state.resetHandler = null;
        }
        span.style.transition = 'none';
        if (state.transitionTimeoutId) {
          clearTimeout(state.transitionTimeoutId);
          state.transitionTimeoutId = 0;
        }

        state.timeoutId = window.setTimeout(() => {
          state.timeoutId = 0;
          state.frameId = requestAnimationFrame(tick);
        }, TEXT_SCROLL_RESET_DELAY);
      };

      state.resetHandler = onTransitionEnd;
      span.addEventListener('transitionend', onTransitionEnd, { once: true });

      // Fallback in case transitionend does not fire (e.g., element hidden).
      state.transitionTimeoutId = window.setTimeout(() => {
        onTransitionEnd();
      }, TEXT_SCROLL_RESET_ANIMATION_MS + 50);

      // Trigger the animated reset on the next frame to ensure styles take effect.
      requestAnimationFrame(() => {
        span.style.transition = `transform ${TEXT_SCROLL_RESET_ANIMATION_MS}ms ease-out`;
        span.style.transform = 'translateX(0)';
      });
      return;
    }

    span.style.transition = 'none';
    span.style.transform = `translateX(${-offset}px)`;
    state.frameId = requestAnimationFrame(tick);
  };

  span.style.transform = 'translateX(0)';
  span.style.transition = 'none';
  state.timeoutId = window.setTimeout(() => {
    state.timeoutId = 0;
    state.frameId = requestAnimationFrame(tick);
  }, TEXT_SCROLL_RESET_DELAY);
  textScrollAnimations.set(element, state);
}

function setBodyCssVariable(name, value) {
  if (!document.body) {
    return;
  }
  if (value === undefined || value === null || value === '') {
    document.body.style.removeProperty(name);
  } else {
    document.body.style.setProperty(name, value);
  }
}

function normalizeThemeOptions(options) {
  if (!options || typeof options !== 'object') {
    return { ...DEFAULT_THEME_OPTIONS };
  }

  const normalized = { ...DEFAULT_THEME_OPTIONS };
  if (typeof options.shadowStyle === 'string') {
    const candidate = options.shadowStyle.toLowerCase();
    if (candidate === 'macos') {
      normalized.shadowStyle = 'macos';
    } else if (candidate === 'none') {
      normalized.shadowStyle = 'none';
    }
  }

  return normalized;
}

function applyThemeOptions(options) {
  const next = normalizeThemeOptions(options);
  if (next.shadowStyle === currentThemeOptions.shadowStyle) {
    return;
  }

  currentThemeOptions = next;

  switch (next.shadowStyle) {
    case 'macos':
      setBodyCssVariable('--overlay-shadow', '0 58px 120px rgba(8, 10, 22, 0.55), 0 18px 48px rgba(10, 12, 24, 0.42)');
      setBodyCssVariable('--layout-safe-inset', '80px');
      break;
    case 'none':
    default:
      setBodyCssVariable('--overlay-shadow', '');
      setBodyCssVariable('--layout-safe-inset', '');
      break;
  }
}

function clampChannel(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function mixChannel(base, sample, ratio) {
  return base * (1 - ratio) + sample * ratio;
}

function getLuma(rgb) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function adjustFancyLuma(rgb) {
  const luma = getLuma(rgb);
  if (luma > FANCY_MAX_LUMA) {
    const ratio = (luma - FANCY_MAX_LUMA) / (255 - FANCY_MAX_LUMA);
    return rgb.map((channel, index) => clampChannel(mixChannel(channel, FANCY_BASE_RGB[index], ratio)));
  }

  if (luma < FANCY_MIN_LUMA) {
    const ratio = (FANCY_MIN_LUMA - luma) / FANCY_MIN_LUMA;
    return rgb.map((channel) => clampChannel(channel + (255 - channel) * ratio * 0.25));
  }

  return rgb.map((channel) => clampChannel(channel));
}

function computeAverageColorFromImage(image) {
  if (!fancyColorCtx) {
    return null;
  }

  fancyColorCtx.clearRect(0, 0, fancyCanvasSize, fancyCanvasSize);
  fancyColorCtx.drawImage(image, 0, 0, fancyCanvasSize, fancyCanvasSize);
  let imageData;
  try {
    imageData = fancyColorCtx.getImageData(0, 0, fancyCanvasSize, fancyCanvasSize);
  } catch (error) {
    console.warn('Failed to sample artwork colors', error);
    return null;
  }
  const { data } = imageData;

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha === 0) {
      continue;
    }
    r += data[i] * alpha;
    g += data[i + 1] * alpha;
    b += data[i + 2] * alpha;
    count += alpha;
  }

  if (count === 0) {
    return null;
  }

  return [r / count, g / count, b / count];
}

function buildFancyOverlayColor(image) {
  const average = computeAverageColorFromImage(image);
  if (!average) {
    return null;
  }

  const blended = average.map((channel, index) => mixChannel(FANCY_BASE_RGB[index], channel, FANCY_BLEND_RATIO));
  const adjusted = adjustFancyLuma(blended);
  return `rgba(${adjusted.map(clampChannel).join(', ')}, 0.86)`;
}

function clearFancyDynamicStyling() {
  if (!document.body) {
    return;
  }
  document.body.style.removeProperty('--overlay-background-dynamic');
}

function applyFancyDynamicPalette(force = false) {
  if (!document.body) {
    return;
  }

  if (currentTheme !== 'fancy') {
    clearFancyDynamicStyling();
    return;
  }

  if (!coverEl || coverEl.classList.contains('hidden')) {
    clearFancyDynamicStyling();
    return;
  }

  if (!force && !coverEl.complete) {
    return;
  }

  const overlayColor = buildFancyOverlayColor(coverEl);
  if (!overlayColor) {
    clearFancyDynamicStyling();
    return;
  }

  document.body.style.setProperty('--overlay-background-dynamic', overlayColor);
}

function getTrackSignature(track) {
  if (!track) {
    return null;
  }

  const parts = [track.id ?? '', track.title ?? '', track.artist ?? '', track.album ?? ''];
  return parts.join('|');
}

function applyTheme(themeName) {
  const desired = typeof themeName === 'string' && themeName.trim().length > 0 ? themeName.trim().toLowerCase() : DEFAULT_THEME;

  if (desired === currentTheme) {
    return;
  }

  currentTheme = desired;

  if (themeLink) {
    themeLink.setAttribute('href', `${THEME_BASE_PATH}${desired}.css`);
  }

  if (document.body) {
    document.body.dataset.theme = desired;
  }

  if (desired === 'fancy') {
    applyFancyDynamicPalette(true);
  } else {
    clearFancyDynamicStyling();
  }
}

function triggerTrackTransition() {
  if (!overlayEl) {
    return;
  }

  overlayEl.classList.remove('transitioning');
  // Force reflow so that the animation restarts even if the class was already present.
  void overlayEl.offsetWidth;
  overlayEl.classList.add('transitioning');
}

function clearTrackDisplay() {
  currentTrackSignature = null;
  wrapScrollableContent(titleEl, 'No Now Playing');
  wrapScrollableContent(artistEl, '');
  wrapScrollableContent(albumEl, '');
  coverEl.src = '';
  coverEl.classList.add('hidden');
  clearFancyDynamicStyling();
}

function updateTrackDisplay(payload) {
  wrapScrollableContent(titleEl, payload.track?.title ?? 'Unknown track');
  wrapScrollableContent(artistEl, payload.track?.artist ?? 'Unknown artist');
  wrapScrollableContent(albumEl, payload.track?.album ?? '');

  if (payload.coverArt?.url) {
    coverEl.src = payload.coverArt.url;
    coverEl.classList.remove('hidden');
    if (currentTheme === 'fancy' && coverEl.complete && coverEl.naturalWidth > 0) {
      applyFancyDynamicPalette(true);
    }
  } else {
    coverEl.src = '';
    coverEl.classList.add('hidden');
    clearFancyDynamicStyling();
  }
}

function updateNowPlaying(payload) {
  applyTheme(payload.theme);
  applyThemeOptions(payload.themeOptions);

  if (!payload.playing) {
    clearTrackDisplay();
    return;
  }

  const nextSignature = getTrackSignature(payload.track);
  const shouldAnimate = Boolean(nextSignature && nextSignature !== currentTrackSignature);

  updateTrackDisplay(payload);

  if (shouldAnimate) {
    triggerTrackTransition();
  }

  currentTrackSignature = nextSignature;
}

async function fetchNowPlaying() {
  if (!userSlug) {
    return;
  }

  try {
    const response = await fetch(`/api/users/${encodeURIComponent(userSlug)}/now-playing`);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    updateNowPlaying(data);

    scheduleNextFetch(data.refreshIntervalMs ?? DEFAULT_REFRESH_MS);
  } catch (error) {
    console.error('Failed to fetch now playing data', error);
    scheduleNextFetch(DEFAULT_REFRESH_MS * 2);
  }
}

function scheduleNextFetch(delay) {
  if (refreshHandle) {
    clearTimeout(refreshHandle);
  }
  refreshHandle = setTimeout(fetchNowPlaying, delay ?? DEFAULT_REFRESH_MS);
}

clearTrackDisplay();
fetchNowPlaying();
