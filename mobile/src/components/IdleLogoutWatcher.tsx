import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const WARNING_SECONDS = 60;

/**
 * Signs the user out after IDLE_LIMIT_MS of no touch activity, warning them
 * with a countdown for the last WARNING_SECONDS first — the mobile
 * counterpart of the web client's IdleLogoutWatcher, same thresholds.
 * Backgrounding counts as idle too: returning to the foreground after being
 * away longer than the limit signs out immediately rather than waiting for
 * a countdown that never had anywhere to run while backgrounded.
 *
 * Activity is captured via `onStartShouldSetResponderCapture` on the
 * wrapping View — it fires in the capture phase, before any descendant
 * (Pressable, ScrollView, a gesture-handler drag) claims the touch
 * responder, and returning `false` lets the touch continue through
 * completely untouched.
 */
export function IdleLogoutWatcher({ children }: { children: ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  // A ref, not state, so the responder-capture handler (registered once)
  // always reads the current value without needing to re-render for it.
  const warningActive = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  const stopCountdown = useCallback(() => {
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    countdownInterval.current = null;
  }, []);

  const startIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      warningActive.current = true;
      setWarningSecondsLeft(WARNING_SECONDS);
      countdownInterval.current = setInterval(() => {
        // Just the countdown — reaching zero is handled by the effect below,
        // not here. Calling logout() (which updates AuthContext's state) from
        // inside this updater function fires while React is still resolving
        // IdleLogoutWatcher's own render, which is exactly the "Cannot update
        // a component while rendering a different component" violation.
        setWarningSecondsLeft((seconds) => (seconds !== null && seconds > 0 ? seconds - 1 : seconds));
      }, 1000);
    }, IDLE_LIMIT_MS - WARNING_SECONDS * 1000);
  }, []);

  useEffect(() => {
    if (warningSecondsLeft === 0) {
      stopCountdown();
      void logout();
    }
  }, [warningSecondsLeft, logout, stopCountdown]);

  const recordActivity = useCallback(() => {
    // Once the "still there?" prompt is up, only its own "Stay signed in"
    // button should dismiss it — an incidental touch elsewhere shouldn't
    // silently extend a security timeout without confirming someone is
    // actually back. Always return false: this handler only observes, it
    // never claims the touch responder.
    if (!warningActive.current) startIdleTimer();
    return false;
  }, [startIdleTimer]);

  const stayLoggedIn = useCallback(() => {
    warningActive.current = false;
    stopCountdown();
    setWarningSecondsLeft(null);
    startIdleTimer();
  }, [startIdleTimer, stopCountdown]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      stopCountdown();
      warningActive.current = false;
      // Dismiss a warning that was already showing when the session itself
      // ended (e.g. the "Log out now" button inside it, or a 401 elsewhere).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWarningSecondsLeft(null);
      backgroundedAt.current = null;
      return;
    }
    startIdleTimer();
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;
        if (away >= IDLE_LIMIT_MS) {
          stopCountdown();
          warningActive.current = false;
          setWarningSecondsLeft(null);
          void logout();
        } else {
          stayLoggedIn();
        }
      } else {
        backgroundedAt.current = Date.now();
      }
    });
    return () => {
      subscription.remove();
      if (idleTimer.current) clearTimeout(idleTimer.current);
      stopCountdown();
    };
    // isAuthenticated alone drives start/stop; the callbacks it reaches for
    // are stable across the authenticated session, so including them here
    // would only tear down and rebuild the AppState subscription for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <View style={styles.flex} onStartShouldSetResponderCapture={recordActivity}>
      {children}
      <Modal visible={warningSecondsLeft !== null} transparent animationType="fade" onRequestClose={stayLoggedIn}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Still there?</Text>
            <Text style={styles.body}>You&apos;ve been inactive for a while. For your security, you&apos;ll be signed out in {warningSecondsLeft}s.</Text>
            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={() => void logout()}>
                <Text style={styles.secondaryButtonText}>Log out now</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={stayLoggedIn}>
                <Text style={styles.primaryButtonText}>Stay signed in</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  secondaryButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.muted, fontWeight: '600', fontSize: 14 },
  primaryButton: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
