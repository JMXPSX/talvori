/**
 * Layout breakpoints.
 *
 * The split is by VIEWPORT WIDTH, not by Platform.OS: the app ships as a
 * Web-PWA, so a phone browser must get the mobile layout (bottom tabs, single
 * column) while a desktop browser gets the sidebar and the multi-column bento
 * grid. Native tablets in landscape get the wide layout for free.
 *
 * `isWideLayout` is pure so it can be unit-tested; `useIsWideLayout` is the hook
 * screens and layouts actually call.
 */

import { useWindowDimensions } from 'react-native';

/** Below this, navigation is bottom tabs and content is a single column. */
export const WIDE_LAYOUT_MIN_WIDTH = 1024;

export function isWideLayout(width: number): boolean {
  return width >= WIDE_LAYOUT_MIN_WIDTH;
}

export function useIsWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return isWideLayout(width);
}
