/**
 * Jest setup (jest-expo preset). Keep global mocks minimal and deterministic so
 * unit tests don't depend on device locale or native modules.
 */

// @testing-library/react-native v12.4+ auto-extends Jest with its matchers
// (e.g. toBeOnTheScreen) — no explicit matcher import required.

// AsyncStorage has no native backing under jest — use the library's ships-in-box
// mock so modules that import it (e.g. the ThemeProvider) load in component tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Deterministic locale for tests regardless of CI machine settings.
jest.mock('expo-localization', () => ({
  getLocales: () => [
    {
      languageCode: 'en',
      languageTag: 'en-US',
      regionCode: 'US',
      currencyCode: 'USD',
      textDirection: 'ltr',
    },
  ],
  getCalendars: () => [],
}));
