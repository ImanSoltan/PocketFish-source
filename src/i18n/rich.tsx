// Texts with a little markup, as React elements: <b>bold</b>, <m>muted</m>, <v>a move</v>, and <k>a button</k>:
// a button of the app, as a small chip with its icon (when one is given), so the text shows what to look for.
// Only these tags are understood, and everything else stays plain text (nothing is parsed as HTML).
import type { ReactNode } from 'react';
import { t, type MessageKey } from '.';

const TAGS: Record<string, (children: string, key: number, icon?: ReactNode) => ReactNode> = {
  b: (c, k) => <b key={k}>{c}</b>,
  m: (c, k) => (
    <span key={k} className="muted">
      {c}
    </span>
  ),
  v: (c, k) => (
    <span key={k} className="solve-move">
      {c}
    </span>
  ),
  k: (c, k, icon) => (
    <span key={k} className="ui-chip">
      {icon}
      {c}
    </span>
  ),
};

export function rich(text: string, icon?: ReactNode): ReactNode {
  const parts: ReactNode[] = [];
  const re = /<(b|m|v|k)>(.*?)<\/\1>/g;
  let last = 0;
  let i = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(TAGS[m[1]](m[2], i++, icon));
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** t() with markup; `icon` goes into the <k> chips. */
export const tr = (key: MessageKey, params?: Record<string, string | number>, icon?: ReactNode): ReactNode =>
  rich(t(key, params), icon);
