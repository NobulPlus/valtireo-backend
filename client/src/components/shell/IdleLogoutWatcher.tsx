import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const WARNING_SECONDS = 60;

// Deliberately not `mousemove` — a security timeout should reset on an
// actual action, not a stray pixel of cursor drift while someone is away
// from the desk.
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * Signs the user out after IDLE_LIMIT_MS of no activity, warning them with a
 * countdown for the last WARNING_SECONDS first. Mounted once, inside
 * AppShell, so it only runs for an authenticated session. logout() already
 * clears local state and best-effort revokes the token server-side, and the
 * existing cross-tab `storage` listener in AuthContext means this cascades
 * to every open tab, not just the one that actually timed out.
 */
export function IdleLogoutWatcher() {
  const { isAuthenticated, logout } = useAuth();
  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();
  const countdownInterval = useRef<ReturnType<typeof setInterval>>();
  // A ref, not state, so the activity listener (registered once) always
  // reads the current value without needing to re-subscribe on every change.
  const warningActive = useRef(false);

  const stopCountdown = useCallback(() => {
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    countdownInterval.current = undefined;
  }, []);

  const startIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      warningActive.current = true;
      setWarningSecondsLeft(WARNING_SECONDS);
      countdownInterval.current = setInterval(() => {
        // Just the countdown — reaching zero is handled by the effect below,
        // not here. Calling logout() (which updates AuthContext's state) from
        // inside this updater function would fire while React is still
        // resolving IdleLogoutWatcher's own render: an "update a component
        // while rendering a different component" violation, caught loudly
        // on React Native and silently on web, but illegal on both.
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

  const handleActivity = useCallback(() => {
    // Once the "still there?" prompt is up, only its own "Stay signed in"
    // button should dismiss it — activity elsewhere (a stray scroll, a
    // background tab regaining focus) shouldn't silently extend a security
    // timeout without confirming someone is actually back.
    if (warningActive.current) return;
    startIdleTimer();
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
      setWarningSecondsLeft(null);
      return;
    }
    startIdleTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      stopCountdown();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [isAuthenticated, startIdleTimer, handleActivity, stopCountdown]);

  return (
    <Modal
      open={warningSecondsLeft !== null}
      onClose={stayLoggedIn}
      title="Still there?"
      footer={
        <>
          <Button variant="ghost" onClick={() => void logout()}>Log out now</Button>
          <Button onClick={stayLoggedIn}>Stay signed in</Button>
        </>
      }
    >
      <p>You&apos;ve been inactive for a while. For your security, you&apos;ll be signed out in {warningSecondsLeft}s.</p>
    </Modal>
  );
}
