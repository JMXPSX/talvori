/**
 * Delivery of the export JSON to the user.
 *   - web: Blob + anchor download (Alert-style share sheets don't exist there)
 *   - native: the built-in Share sheet with the JSON as text. Deliberately
 *     dependency-free; swap for expo-file-system + expo-sharing if exports
 *     outgrow text sharing.
 */

import { Platform, Share } from 'react-native';

export async function saveExport(json: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: filename, message: json });
}
