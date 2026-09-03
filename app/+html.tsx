/**
 * Web-only root HTML shell (Expo Router). Adds Talvori identity + PWA hints to
 * the <head>: the apple-touch-icon (home-screen icon when "Add to Home Screen"),
 * standalone display so it launches full-screen without Safari chrome, and the
 * brand theme colour. This overrides Expo's default document, so it must also
 * carry the standard charset/viewport/ScrollViewStyleReset it normally injects.
 */

import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Match the app background so there is no white flash before the JS mounts.
const bodyBackground = `
body { background-color: #F6F5FB; }
@media (prefers-color-scheme: dark) { body { background-color: #0E0B1A; } }`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Talvori identity + installable-PWA hints */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Talvori" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Talvori" />
        <meta name="theme-color" content="#6D4CFF" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: bodyBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
