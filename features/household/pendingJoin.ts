/**
 * Persist a household invite code across the sign-in redirect. A shared
 * /join/<code> link opened while signed out stashes the code here; after the
 * user authenticates, the auth gate resumes the join. Best-effort — storage
 * failures degrade to "no pending code", never throw into the UI.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'talvori.pendingJoinCode';

export async function setPendingJoinCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, code);
  } catch {
    /* non-fatal */
  }
}

export async function getPendingJoinCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function clearPendingJoinCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* non-fatal */
  }
}
