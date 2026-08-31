/**
 * Runtime theming (4c). Holds the user's appearance preference — 'system' (follow
 * the OS), 'light', or 'dark' — persisted across launches, and resolves it to the
 * active {@link Palette}. Screens read the palette via {@link useTheme} and build
 * their StyleSheets through {@link useThemedStyles} so the whole app reskins when
 * the scheme flips (light/dark share token names; only the values change).
 *
 * `palette` in `components/theme` stays a static light alias, so a screen that
 * hasn't been migrated to the hook keeps compiling and renders light.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, StyleSheet } from 'react-native';

import { darkPalette, lightPalette, type Palette } from '@/components/theme';
import { logger } from '@/lib/logger';

// Re-exported so consumers can pull the theming API + its type from one module.
export type { Palette } from '@/components/theme';

export type ThemeScheme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'talvori.theme.scheme';
const SCHEMES: readonly ThemeScheme[] = ['system', 'light', 'dark'];

interface ThemeContextValue {
  /** The user's preference: 'system' | 'light' | 'dark'. */
  scheme: ThemeScheme;
  /** Resolved dark state (system preference applied). */
  isDark: boolean;
  /** The active palette (light or dark). */
  palette: Palette;
  setScheme: (scheme: ThemeScheme) => void;
}

// Default = light, no-op setter. Rendering outside a provider (e.g. isolated
// component tests, or the pre-provider font-loading gate) falls back to light
// instead of throwing.
const DEFAULT_THEME: ThemeContextValue = {
  scheme: 'system',
  isDark: false,
  palette: lightPalette,
  setScheme: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(DEFAULT_THEME);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ThemeScheme>('system');
  const [systemDark, setSystemDark] = useState(() => Appearance.getColorScheme() === 'dark');

  // Hydrate the persisted choice and follow live OS-scheme changes.
  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && (SCHEMES as readonly string[]).includes(stored)) {
          setSchemeState(stored as ThemeScheme);
        }
      })
      .catch((err) => logger.warn('Theme preference load failed.', { error: String(err) }));

    const sub = Appearance.addChangeListener(({ colorScheme }) =>
      setSystemDark(colorScheme === 'dark'),
    );
    return () => sub.remove();
  }, []);

  const setScheme = useCallback((next: ThemeScheme) => {
    setSchemeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch((err) =>
      logger.warn('Theme preference save failed.', { error: String(err) }),
    );
  }, []);

  const isDark = scheme === 'system' ? systemDark : scheme === 'dark';
  const palette = isDark ? darkPalette : lightPalette;

  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, isDark, palette, setScheme }),
    [scheme, isDark, palette, setScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Active theme. Falls back to the default light theme outside a provider. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Build a StyleSheet from the active palette, memoized per palette. Define the
 * factory at module scope so its reference is stable:
 *
 *   const makeStyles = (c: Palette) => StyleSheet.create({ card: { backgroundColor: c.surface } });
 *   // inside the component:
 *   const styles = useThemedStyles(makeStyles);
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (palette: Palette) => T,
): T {
  const { palette } = useTheme();
  return useMemo(() => factory(palette), [factory, palette]);
}
