// Colour schemes. The colours themselves live in styles.css (CSS variables per
// [data-scheme]); this file lists them and applies the chosen one.
import { isNative } from './platform';

export interface Scheme {
  id: string;
  name: string;
  description: string;
  dark: boolean;
  /** board colours that match the scheme (Board THEMES name) */
  board: string;
  /** browser / status-bar colour (meta theme-color) */
  bar: string;
  /** colours for the preview swatch in Settings */
  preview: [string, string, string];
}

export const SCHEMES: Scheme[] = [
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Crisp blue on cool greys',
    dark: false,
    board: 'ocean',
    bar: '#f3f6fb',
    preview: ['#f3f6fb', '#2563eb', '#8ba3c4'],
  },
  {
    id: 'indigo',
    name: 'Indigo',
    description: 'Violet accent, lavender board',
    dark: false,
    board: 'lavender',
    bar: '#f6f5fb',
    preview: ['#f6f5fb', '#6d5dfc', '#a69ed3'],
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Dark mode with electric blue',
    dark: true,
    board: 'slate',
    bar: '#0b0e14',
    preview: ['#0b0e14', '#3b9eff', '#62748e'],
  },
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Neutral greys with a coral accent',
    dark: false,
    board: 'stone',
    bar: '#f2f2f4',
    preview: ['#f2f2f4', '#ff5a3c', '#a9a49c'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm orange on cream',
    dark: false,
    board: 'walnut',
    bar: '#fbf6f1',
    preview: ['#fbf6f1', '#f97316', '#bf8e66'],
  },
];

/** 'auto' follows the system: Ocean by day, Midnight in dark mode. */
export const AUTO_LIGHT = 'ocean';
export const AUTO_DARK = 'midnight';

export function systemDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveScheme(id: string): Scheme {
  const want = id === 'auto' ? (systemDark() ? AUTO_DARK : AUTO_LIGHT) : id;
  return SCHEMES.find((s) => s.id === want) ?? SCHEMES[0];
}

export function applyScheme(id: string): Scheme {
  const scheme = resolveScheme(id);
  document.documentElement.dataset.scheme = scheme.id;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = scheme.bar;
  if (isNative()) {
    // light status-bar text on dark schemes, dark text on light ones
    import('@capacitor/status-bar')
      .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: scheme.dark ? Style.Dark : Style.Light }))
      .catch(() => undefined);
  }
  return scheme;
}
