// What kind of device and shell the game is running in, so phones get a
// phone-shaped game: touch-sized controls, panes instead of columns, a symbol
// bar over the keyboard, swipes.
import { useSyncExternalStore } from 'react';

declare global {
  interface Window {
    /** Present when running inside the native iPhone/Android app (Capacitor). */
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }
}

/** The native iPhone or Android app (as opposed to a browser or the home-screen web app). */
export const isNativeApp = () => !!window.Capacitor?.isNativePlatform?.();

/** A finger, not a mouse, is the main pointer. */
export const isTouch = () => matchMedia('(pointer: coarse)').matches;

/** iPhone, iPad or iPod (iPadOS reports itself as a Mac, but with touch). */
export const isApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/** Launched from the home screen (or the native app): no browser chrome around us. */
export const isStandalone = () =>
  isNativeApp() || matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const PHONE = '(max-width: 760px)';

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => matchMedia(query).matches,
  );
}

/** A phone-width screen (the layout switches to panes and a bottom tab bar). */
export const usePhone = () => useMedia(PHONE);
export const useTouch = () => useMedia('(pointer: coarse)');

/**
 * Is the on-screen keyboard up, and how much of the screen does it cover?
 * Phones shrink the visual viewport (not the layout) when the keyboard opens.
 */
export function useKeyboard(): { open: boolean; inset: number } {
  const inset = useSyncExternalStore(
    (cb) => {
      const vv = window.visualViewport;
      vv?.addEventListener('resize', cb);
      vv?.addEventListener('scroll', cb);
      return () => {
        vv?.removeEventListener('resize', cb);
        vv?.removeEventListener('scroll', cb);
      };
    },
    () => {
      const vv = window.visualViewport;
      return vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    },
  );
  return { open: inset > 120, inset };
}
