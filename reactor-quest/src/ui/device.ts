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

/**
 * A finger, not a mouse, is the main pointer. Some Android WebViews don't
 * report a coarse pointer, so the native app always counts, and so does any
 * touch screen that can't hover.
 */
export const isTouch = () =>
  isNativeApp() || matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);

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
export const useTouch = () => {
  const coarse = useMedia('(pointer: coarse)');
  return coarse || isTouch();
};

/**
 * How much of the screen the on-screen keyboard covers. iOS keeps the page's
 * size and shrinks only the *visual* viewport; Android usually resizes the
 * whole page. Comparing the visible height with the tallest seen at this width
 * catches both. (main.tsx keeps --vvh and data-keyboard up to date with it.)
 */
let tallest = { width: 0, height: 0 };
export function keyboardInset(): number {
  const vv = window.visualViewport;
  const visible = vv ? vv.height : window.innerHeight;
  if (window.innerWidth !== tallest.width) tallest = { width: window.innerWidth, height: 0 }; // rotated
  tallest.height = Math.max(tallest.height, window.innerHeight, visible);
  return Math.max(0, Math.round(tallest.height - visible));
}

export function useKeyboard(): { open: boolean; inset: number } {
  const inset = useSyncExternalStore(
    (cb) => {
      const vv = window.visualViewport;
      vv?.addEventListener('resize', cb);
      vv?.addEventListener('scroll', cb);
      window.addEventListener('resize', cb);
      return () => {
        vv?.removeEventListener('resize', cb);
        vv?.removeEventListener('scroll', cb);
        window.removeEventListener('resize', cb);
      };
    },
    keyboardInset,
  );
  return { open: inset > 120, inset };
}
