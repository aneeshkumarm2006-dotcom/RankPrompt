/** Build-time settings (Vite `VITE_*`). There is no API URL: the app always calls same-origin /api. */
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

/** How to reach the team (legal pages). */
export const CONTACT_URL = 'https://davnoot.com/contact';

/** Where the promo popup sends people (F-33, v1 PromoPopup). */
export const PROMO_URL = CONTACT_URL;

/** Seconds after run creation before the promo popup shows (v1: 15 s). */
export const PROMO_DELAY_MS = 15_000;
