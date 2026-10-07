import { useEffect, useState } from 'react';

const TOKENS = {
  surface: '--surface',
  ink: '--ink',
  ink2: '--ink-2',
  muted: '--muted',
  grid: '--grid',
  baseline: '--baseline',
  series1: '--series-1',
  deemphasis: '--deemphasis',
};
export const SEQUENTIAL_STEPS = 9;

function read() {
  const style = getComputedStyle(document.documentElement);
  const theme = Object.fromEntries(Object.entries(TOKENS).map(([k, v]) => [k, style.getPropertyValue(v).trim()]));
  theme.sequential = Array.from({ length: SEQUENTIAL_STEPS }, (_, i) => style.getPropertyValue(`--seq-${i + 1}`).trim());
  return theme;
}

/** Chart colours come from CSS tokens so light and dark mode stay in one place (styles.css). */
export function useChartTheme() {
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setTheme(read());
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return theme;
}

/** Picks white or ink text for a label sitting inside a coloured cell. */
export function textOn(hex) {
  const value = hex.replace('#', '');
  if (value.length !== 6) return '#0b0b0b';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.36 ? '#0b0b0b' : '#ffffff';
}

export const axisProps = (theme) => ({
  tick: { fill: theme.muted, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: theme.baseline },
});
