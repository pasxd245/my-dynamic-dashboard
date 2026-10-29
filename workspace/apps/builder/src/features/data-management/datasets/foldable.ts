// R204 — fold the dataset page's context sections so the table keeps its height on short screens.
//
// A section is open when the viewer said so (remembered per browser), otherwise by the viewport:
// open on tall viewports, folded below SHORT_VIEWPORT_PX. A laptop at 1366 × 768, or a 1920 × 1080
// screen at 125 % scale, leaves ~620–740 CSS px for the page; the strips and the advanced query
// took ~230 px of it and the table showed one or two rows (R202 visual gate; first user's screen).

import { useCallback, useEffect, useState } from 'react';

/** Below this viewport height (CSS px) the sections start folded unless the viewer opened them. */
export const SHORT_VIEWPORT_PX = 760;
const SHORT_QUERY = `(max-height: ${SHORT_VIEWPORT_PX - 1}px)`;
const KEY = 'mdd.datasetDetail.open.';

export type FoldSection = 'details' | 'advancedQuery';

function readChoice(section: FoldSection): boolean | undefined {
  try {
    const v = globalThis.localStorage?.getItem(KEY + section);
    return v === '1' ? true : v === '0' ? false : undefined;
  } catch {
    return undefined;
  }
}

function saveChoice(section: FoldSection, open: boolean) {
  try {
    globalThis.localStorage?.setItem(KEY + section, open ? '1' : '0');
  } catch {
    /* storage blocked — the choice lasts this visit only */
  }
}

function isShort(): boolean {
  try {
    return globalThis.matchMedia?.(SHORT_QUERY).matches ?? false;
  } catch {
    return false;
  }
}

/** True while the viewport is shorter than SHORT_VIEWPORT_PX; follows resizes. */
export function useShortViewport(): boolean {
  const [short, setShort] = useState(isShort);
  useEffect(() => {
    let mql: MediaQueryList | undefined;
    try {
      mql = globalThis.matchMedia?.(SHORT_QUERY);
    } catch {
      mql = undefined;
    }
    if (!mql) return undefined;
    const list = mql;
    const on = () => setShort(list.matches);
    on();
    // Safari < 14 has only the deprecated addListener/removeListener.
    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', on);
      return () => list.removeEventListener('change', on);
    }
    list.addListener?.(on);
    return () => list.removeListener?.(on);
  }, []);
  return short;
}

/**
 * [open, toggle] for one section. The viewer's last choice wins; without one the section follows
 * the viewport (open unless short). Toggling records the choice.
 */
export function useFoldable(section: FoldSection): readonly [boolean, () => void] {
  const short = useShortViewport();
  const [choice, setChoice] = useState<boolean | undefined>(() => readChoice(section));
  const open = choice ?? !short;
  const toggle = useCallback(() => {
    const next = !open;
    setChoice(next);
    saveChoice(section, next);
  }, [open, section]);
  return [open, toggle] as const;
}
