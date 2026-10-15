import { useEffect, useState } from 'react';
import { PROMO_DELAY_MS } from '../../lib/config';
import { on } from '../../lib/events';
import { PromoPopup } from './PromoPopup';

/** sessionStorage key: the popup already showed in this browser session. */
export const PROMO_SHOWN_KEY = 'pv:promoShown';

/** Fallback when storage is blocked (private mode, sandboxed frames). */
let shownInMemory = false;

function wasShown(): boolean {
  try {
    return sessionStorage.getItem(PROMO_SHOWN_KEY) === '1';
  } catch {
    return shownInMemory;
  }
}

function markShown(): void {
  try {
    sessionStorage.setItem(PROMO_SHOWN_KEY, '1');
  } catch {
    shownInMemory = true;
  }
}

/**
 * Rendered once at the router root (F-33). `PROMO_DELAY_MS` after the first run created in this
 * browser session, shows the promo popup, once per session. Event-driven: no polling (09).
 */
export function PromoPopupHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = on('runCreated', () => {
      if (timer !== undefined || wasShown()) return;
      timer = setTimeout(() => {
        if (wasShown()) return;
        markShown();
        setOpen(true);
      }, PROMO_DELAY_MS);
    });
    return () => {
      off();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  return open ? <PromoPopup onClose={() => setOpen(false)} /> : null;
}
