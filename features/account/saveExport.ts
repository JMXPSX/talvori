/**
 * Delivery of the export JSON to the user.
 *   - web: Blob + anchor download (share sheets don't exist there)
 *   - native: write a real .json file to the cache and open the share sheet
 *     (dynamic imports keep the native modules out of the web bundle path).
 */

import { Platform } from 'react-native';

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

  const [FileSystem, Sharing] = await Promise.all([
    import('expo-file-system/legacy'),
    import('expo-sharing'),
  ]);
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, json);
  await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: filename });
}
