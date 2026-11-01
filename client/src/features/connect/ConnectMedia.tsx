import { useEffect, useState, useSyncExternalStore } from 'react';
import { apiClient, getStoredToken } from '@/lib/apiClient';
import { onSessionChange } from '@/lib/sessionEvents';
import type { Message, Person } from './chatTypes';

function useConnectBlob(endpoint?: string | null) {
  const token = useSyncExternalStore(onSessionChange, getStoredToken, () => null);
  const [result, setResult] = useState<{ endpoint: string; token: string; url: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!endpoint || !token || !/^\/connect\/(people\/\d+\/photo|conversations\/[\w-]+\/messages\/\d+\/file)(\?|$)/.test(endpoint)) return;
    let alive = true; let url: string | null = null;
    apiClient.get<Blob>(endpoint, { responseType: 'blob' }).then(({ data }) => {
      if (!alive) return;
      url = URL.createObjectURL(data); setResult({ endpoint, token, url }); setError('');
    }).catch(() => { if (alive) setError('This file is unavailable.'); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [endpoint, token]);
  return { url: result?.token === token && result?.endpoint === endpoint ? result.url : null, error };
}
// A small, fixed palette so each person's initials-avatar reads as a stable
// color across the app (not random per render) — keyed by user id, matching
// the design canvas mockup every Connect avatar uses.
const AVATAR_PALETTE = ['#2F8F8A', '#244F7A', '#8B5FD9', '#C47A00', '#B23A6B', '#2E7D5B'];
function avatarColor(id: number): string {
  return AVATAR_PALETTE[id % AVATAR_PALETTE.length];
}

export function ConnectAvatar({ person, size = 36, showStatus = false }: { person: Person; size?: number; showStatus?: boolean }) {
  const { url } = useConnectBlob(person.photo_url);
  const px = `${size}px`;
  return <span className="relative inline-flex shrink-0" style={{ width: px, height: px }}>
    {url
      ? <img src={url} alt="" className="h-full w-full rounded-full object-cover" />
      : <span className="flex h-full w-full items-center justify-center rounded-full font-bold text-white" style={{ background: avatarColor(person.id), fontSize: size * 0.38 }}>{person.name.charAt(0)}</span>}
    {showStatus ? <span className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-surface ${person.active ? 'bg-success' : 'bg-border-strong'}`} style={{ width: size * 0.28, height: size * 0.28 }} aria-hidden="true" /> : null}
  </span>;
}
export function ConnectAttachment({ attachment }: { attachment: NonNullable<Message['attachment']> }) {
  const { url, error } = useConnectBlob(attachment.url);
  if (error) return <p role="alert">{error}</p>;
  if (!url) return <p className="text-xs text-muted">Loading attachment…</p>;
  return <div className="mt-2 space-y-2">
    {attachment.voice_note || attachment.mime.startsWith('audio/') ? <audio controls src={url} preload="metadata" aria-label={attachment.name} /> : attachment.mime.startsWith('image/') ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={attachment.name} className="max-h-64 max-w-full rounded-lg" /></a> : attachment.mime === 'application/pdf' ? <iframe title={attachment.name} src={url} className="h-64 w-full rounded border" sandbox="" /> : null}
    <a href={url} download={attachment.name} className="text-sm text-teal underline">{attachment.name} · {Math.ceil(attachment.size / 1024)} KB</a>
  </div>;
}
