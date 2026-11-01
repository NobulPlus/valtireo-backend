const listeners = new Set<(conversation?: string) => void>();
export function openConnect(conversation?: string) { listeners.forEach((listener) => listener(conversation)); }
export function onOpenConnect(listener: (conversation?: string) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
