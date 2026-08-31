/**
 * Toast (§3.10) — a single non-blocking line that appears on whatever screen the
 * action lands on and auto-dismisses (2.5s for info, 4s for money confirmations).
 * Success uses a green tint + `positiveStrong` text. Never a blocking dialog.
 *
 * Usage: wrap the app in <ToastProvider> (once, near the root), then call
 * `useToast().show('✓ Expense saved — −$86.40', { tone: 'success' })` from any
 * screen. The host renders a floating banner above the bottom nav.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, radius, spacing } from '@/components/theme';
import { useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Text } from '@/components/ui/Text';

export type ToastTone = 'success' | 'info' | 'error';

export interface ToastOptions {
  tone?: ToastTone;
  /** Money confirmations linger longer (4s) than info (2.5s). */
  money?: boolean;
  durationMs?: number;
}

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const show = useCallback((message: string, opts?: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    const id = ++seq.current;
    setToast({ id, message, tone: opts?.tone ?? 'info' });
    const duration = opts?.durationMs ?? (opts?.money ? 4000 : 2500);
    timer.current = setTimeout(() => {
      // Only clear if this is still the visible toast (a newer one may have replaced it).
      setToast((cur) => (cur?.id === id ? null : cur));
    }, duration);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <SafeAreaView pointerEvents="none" style={styles.host} edges={['bottom']}>
          <View
            accessibilityRole="alert"
            style={[styles.toast, toneStyle(styles, toast.tone)]}
          >
            <Text variant="button" style={toneText(styles, toast.tone)} numberOfLines={2}>
              {toast.message}
            </Text>
          </View>
        </SafeAreaView>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

function toneStyle(s: ReturnType<typeof makeStyles>, tone: ToastTone) {
  return tone === 'error' ? s.toastError : tone === 'success' ? s.toastSuccess : s.toastInfo;
}
function toneText(s: ReturnType<typeof makeStyles>, tone: ToastTone) {
  return tone === 'error' ? s.textError : tone === 'success' ? s.textSuccess : s.textInfo;
}

const makeStyles = (c: Palette) => StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Floats above the bottom nav; SafeAreaView adds the home-indicator inset.
    bottom: 78,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  toast: {
    maxWidth: 520,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    boxShadow: elevation.raised,
  },
  toastSuccess: { backgroundColor: c.successSurface },
  toastInfo: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  toastError: { backgroundColor: c.dangerTint },
  textSuccess: { color: c.positiveStrong },
  textInfo: { color: c.ink },
  textError: { color: c.danger },
});
