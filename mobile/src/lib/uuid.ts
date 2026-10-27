/**
 * `crypto.randomUUID()` doesn't exist on Hermes (React Native's JS engine) — it's
 * only in the TypeScript DOM lib types, not the runtime, so this would silently
 * crash on-device despite typechecking cleanly. Used as a client-side message
 * idempotency key, not for anything security-sensitive, so `Math.random()` is fine.
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
