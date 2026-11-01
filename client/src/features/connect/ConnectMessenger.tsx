import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus, Search, PhoneCall, Paperclip, Mic, Send, ChevronLeft, ChevronRight,
  Users, BellOff, Bell, MailWarning, Pin, Reply, ThumbsUp, Heart, PartyPopper, HandHeart, Laugh,
  Pencil, Trash2, Flag, X, Crown, UserMinus, UserPlus, Archive, ArchiveRestore, LogOut, LogIn, ArrowRight,
  Ban, Check, MessageCircle, UsersRound, Megaphone,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { useDepartmentOptions } from '@/features/employees/api';
import { ConnectAttachment, ConnectAvatar } from './ConnectMedia';
import type { Conversation, Message, Page, Person, VoiceCall } from './chatTypes';

const panel = 'rounded-xl border border-border bg-surface';
const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Please try again.');
const REACTION_ICONS = { like: ThumbsUp, heart: Heart, celebrate: PartyPopper, thanks: HandHeart, laugh: Laugh } as const;
const REACTION_LABELS: Record<string, string> = { like: 'Like', heart: 'Love', celebrate: 'Celebrate', thanks: 'Thanks', laugh: 'Laugh' };
const KIND_ICON = { direct: MessageCircle, group: UsersRound, channel: Megaphone } as const;

// How long after sending a message stays deletable — mirrors the same
// window enforced server-side in ConnectChatController@changeMessage.
const DELETE_WINDOW_MS = 15 * 60 * 1000;

function messageTimestamp(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (Date.now() - date.getTime() < 24 * 60 * 60 * 1000) return time;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Date(iso).toLocaleDateString([], { weekday: 'short' });
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function previewText(c: Conversation): string {
  const lm = c.last_message;
  if (!lm) return c.kind === 'channel' ? 'No messages yet' : 'Start the conversation';
  const body = lm.voice_note ? 'Voice note' : lm.has_attachment ? 'Sent an attachment' : lm.body ?? '';
  const prefix = c.kind !== 'direct' && lm.sender_name ? `${lm.sender_name}: ` : '';
  return `${prefix}${body}`;
}

/** Icon-only Previous/Next, reused everywhere this file paginates a list. */
function Pager({ page, hasNext, onChange }: { page: number; hasNext: boolean; onChange: (page: number) => void }) {
  return (
    <div className="flex justify-center gap-2 pt-1">
      <Button variant="ghost" size="icon" aria-label="Previous page" title="Previous page" disabled={page === 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></Button>
      <Button variant="ghost" size="icon" aria-label="Next page" title="Next page" disabled={!hasNext} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></Button>
    </div>
  );
}

function Tabs({ tab, onChange }: { tab: string; onChange: (tab: string) => void }) {
  const items = ['messages', 'channels', 'calls', 'preferences'];
  return (
    <nav className="inline-flex gap-0.5 rounded-xl bg-surface-soft p-1" aria-label="Connect sections">
      {items.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors ${tab === name ? 'bg-surface text-strong shadow-sm' : 'text-muted hover:text-strong'}`}
        >
          {name}
        </button>
      ))}
    </nav>
  );
}

export function ConnectMessenger() {
  const { moduleByKey } = useAuth();
  return (
    <>
      <PageHeader title="Connect" subtitle="Conversations that keep your people together." />
      {moduleByKey('connect')?.can_access ? <Workspace /> : <p className={`${panel} p-4`}>Connect is not enabled for your workspace.</p>}
    </>
  );
}

function Workspace() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { id } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('messages');
  const [create, setCreate] = useState(false);
  const list = useQuery({ queryKey: ['connect', 'conversations', page], queryFn: () => api.get<Page<Conversation>>('/connect/conversations', { params: { page } }), refetchInterval: 5000 });

  return (
    <div className="space-y-4">
      <Tabs tab={tab} onChange={setTab} />
      {tab === 'channels' ? (
        <Channels onOpen={(c) => { setTab('messages'); navigate(`/connect/chat/${c}`); }} />
      ) : tab === 'calls' ? (
        <CallHistory />
      ) : tab === 'preferences' ? (
        <Preferences />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className={`${panel} flex max-h-[760px] flex-col gap-3 p-4`}>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input className="pl-9" placeholder="Search conversations" aria-label="Search conversations" />
              </div>
              <Button variant="primary" size="icon" aria-label="New conversation" title="New conversation" onClick={() => setCreate(!create)}><Plus size={16} /></Button>
            </div>
            <div className="flex flex-col gap-0.5 overflow-y-auto">
              {list.isPending ? (
                <p className="py-6 text-center text-sm text-muted">Loading conversations…</p>
              ) : list.isError ? (
                <p role="alert" className="text-sm text-danger">{list.error.message}</p>
              ) : list.data.data.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">Start a conversation with a colleague.</p>
              ) : (
                list.data.data.map((c) => {
                  const isActive = !create && id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => { setCreate(false); navigate(`/connect/chat/${c.id}`); }}
                      className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors ${isActive ? 'bg-teal-light' : 'hover:bg-surface-soft'}`}
                    >
                      <ConnectAvatar
                        person={c.kind === 'direct' ? c.members.find((m) => m.id !== userId) ?? c.members[0] : ({ id: 0, name: c.name, active: false, department: null, photo_url: null, availability: '' } as Person)}
                        size={40}
                        showStatus={c.kind === 'direct'}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <strong className={`truncate text-sm ${c.unread_count > 0 ? 'font-bold text-strong' : 'font-semibold text-strong'}`}>{c.name}</strong>
                          <small className="shrink-0 text-[11px] text-muted">{relativeTime(c.updated_at)}</small>
                        </span>
                        <span className="flex items-center gap-1">
                          {c.muted ? <BellOff size={11} className="shrink-0 text-muted" /> : null}
                          <small className={`truncate text-xs ${c.unread_count > 0 ? 'font-medium text-strong' : 'text-muted'}`}>{previewText(c)}</small>
                        </span>
                      </span>
                      {c.unread_count > 0 ? <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-teal px-1.5 text-[10.5px] font-bold text-white">{c.unread_count}</span> : null}
                    </button>
                  );
                })
              )}
            </div>
            <Pager page={page} hasNext={!list.data || page < list.data.last_page} onChange={setPage} />
          </aside>

          {create ? (
            <CreateConversation onCreated={(c) => { setCreate(false); navigate(`/connect/chat/${c}`); }} onCancel={() => setCreate(false)} />
          ) : id ? (
            <ConversationView key={id} id={id} />
          ) : (
            <section className={`${panel} flex min-h-96 flex-col items-center justify-center gap-3 p-4 text-center`}>
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-light text-teal"><MessageCircle size={30} /></span>
              <h2 className="font-display text-xl font-bold text-strong">Your team, within reach</h2>
              <p className="text-muted">Choose a conversation or start a new one.</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function CreateConversation({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const cache = useQueryClient();
  const [kind, setKind] = useState<'direct' | 'group' | 'channel'>('direct');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [ids, setIds] = useState<number[]>([]);
  const [visibility, setVisibility] = useState('private');
  const departments = useDepartmentOptions();
  const people = useQuery({
    queryKey: ['connect', 'colleagues', search, departmentId, page],
    queryFn: () => api.get<Page<Person>>('/connect/colleagues', { params: { search, department_id: departmentId ?? undefined, page } }),
  });
  const save = useMutation({
    mutationFn: () => api.post<{ data: Conversation }>('/connect/conversations', { kind, name, visibility, member_ids: ids }),
    onSuccess: ({ data }) => { void cache.invalidateQueries({ queryKey: ['connect'] }); onCreated(data.id); },
  });
  // A direct message needs no "now click Create" step — tapping the person IS
  // the action, same as mobile's own one-tap flow. Takes the id directly
  // rather than going through `ids` state, which a mutation fired in the same
  // tick as its setState wouldn't see yet.
  const openDirect = useMutation({
    mutationFn: (personId: number) => api.post<{ data: Conversation }>('/connect/conversations', { kind: 'direct', member_ids: [personId] }),
    onSuccess: ({ data }) => { void cache.invalidateQueries({ queryKey: ['connect'] }); onCreated(data.id); },
  });
  const departmentOptions = [{ value: '', label: 'All departments' }, ...(departments.data ?? []).map((d) => ({ value: String(d.id), label: d.name }))];
  const selected = people.data?.data.filter((p) => ids.includes(p.id)) ?? [];

  function tapPerson(id: number) {
    if (kind === 'direct') { openDirect.mutate(id); return; }
    setIds((current) => (current.includes(id) ? current.filter((i) => i !== id) : [...current, id]));
  }

  return (
    <section className={`${panel} flex flex-col gap-4 p-5`}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-strong">New conversation</h2>
        <Button variant="ghost" size="icon" aria-label="Cancel" title="Cancel" onClick={onCancel}><X size={16} /></Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['direct', 'group', 'channel'] as const).map((k) => {
          const Icon = KIND_ICON[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => { setKind(k); setIds([]); }}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${kind === k ? 'border-pine bg-pine text-white' : 'border-border bg-surface text-muted hover:text-strong'}`}
            >
              <Icon size={15} />
              {k === 'direct' ? 'Direct message' : k === 'group' ? 'Group' : 'Channel'}
            </button>
          );
        })}
      </div>

      {kind !== 'direct' ? <Input aria-label="Conversation name" placeholder={kind === 'group' ? 'Group name' : 'Channel name'} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /> : null}

      {kind === 'channel' ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => setVisibility('private')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${visibility === 'private' ? 'border-pine bg-pine text-white' : 'border-border text-muted'}`}>Private — invited members</button>
          <button type="button" onClick={() => setVisibility('organization')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${visibility === 'organization' ? 'border-pine bg-pine text-white' : 'border-border text-muted'}`}>Discoverable — org-wide</button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Find colleagues" aria-label="Find colleagues" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="w-44">
          <SelectMenu value={departmentId ?? ''} onChange={(value) => { setDepartmentId(value || null); setPage(1); }} options={departmentOptions} />
        </div>
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-teal-light py-1 pl-3 pr-1 text-xs font-semibold text-teal">
              {p.name.split(' ')[0]}
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => tapPerson(p.id)} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-teal/20"><X size={10} /></button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex max-h-48 flex-col gap-0.5 overflow-auto">
        {people.data?.data.map((p) => {
          const picked = ids.includes(p.id);
          return (
            <button key={p.id} type="button" onClick={() => tapPerson(p.id)} className="flex items-center gap-2.5 rounded-lg p-2 text-left hover:bg-surface-soft">
              <ConnectAvatar person={p} size={32} />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-strong">{p.name}</strong>
                {p.department ? <small className="text-xs text-muted">{p.department}</small> : null}
              </span>
              <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${picked ? 'border-teal bg-teal text-white' : 'border-border'}`}>{picked ? <Check size={11} /> : null}</span>
            </button>
          );
        })}
      </div>
      {people.error ? <p role="alert" className="text-sm text-danger">{people.error.message}</p> : null}
      <Pager page={page} hasNext={!people.data || page < people.data.last_page} onChange={setPage} />

      {save.error ? <p role="alert" className="text-sm text-danger">{save.error.message}</p> : null}
      <Button variant="primary" className="self-start" disabled={save.isPending || (kind === 'direct' && ids.length !== 1) || (kind !== 'direct' && !name.trim())} onClick={() => save.mutate()}>
        {kind === 'direct' ? 'Start conversation' : `Create ${kind}`}
      </Button>
    </section>
  );
}

function Channels({ onOpen }: { onOpen: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['connect', 'channels', page], queryFn: () => api.get<Page<Conversation>>('/connect/channels', { params: { page } }) });
  return (
    <section className={`${panel} p-2`}>
      <h2 className="px-3 pt-2 font-display font-bold text-strong">Organization channels</h2>
      {error || query.error ? <p role="alert" className="px-3 text-sm text-danger">{error || query.error?.message}</p> : null}
      {query.data?.data.map((c) => (
        <div key={c.id} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0">
          <ConnectAvatar person={{ id: 0, name: c.name, active: false, department: null, photo_url: null, availability: '' }} size={38} />
          <span className="flex-1 font-medium text-strong">{c.name}</span>
          {c.joined ? (
            <Button variant="primary" size="icon" aria-label={`Open ${c.name}`} title={`Open ${c.name}`} onClick={() => onOpen(c.id)}><ArrowRight size={16} /></Button>
          ) : (
            <Button variant="secondary" size="icon" aria-label={`Join ${c.name}`} title={`Join ${c.name}`} onClick={() => void api.patch(`/connect/conversations/${c.id}/membership`, { action: 'join' }).then(() => onOpen(c.id)).catch((e) => setError(errorText(e)))}><LogIn size={16} /></Button>
          )}
        </div>
      ))}
      <Pager page={page} hasNext={!query.data || page < query.data.last_page} onChange={setPage} />
    </section>
  );
}

function ConversationView({ id }: { id: string }) {
  const { session } = useAuth();
  const user = session?.user;
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [before, setBefore] = useState<number | undefined>();
  const [reply, setReply] = useState<number | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [error, setError] = useState('');
  const conversation = useQuery({ queryKey: ['connect', 'conversation', id], queryFn: () => api.get<{ data: Conversation }>(`/connect/conversations/${id}`), refetchInterval: 5000 });
  const messages = useQuery({ queryKey: ['connect', 'messages', id, search, pinned, before], queryFn: () => api.get<Message[]>(`/connect/conversations/${id}/messages`, { params: { search, pinned: pinned ? 1 : 0, before } }), refetchInterval: 4000, enabled: !!conversation.data });
  const c = conversation.data?.data;
  const newest = !before && !search && !pinned ? messages.data?.[0]?.id : undefined;

  useEffect(() => {
    if (newest) void api.patch(`/connect/conversations/${id}/membership`, { action: 'read', last_read_id: newest }).then(() => cache.invalidateQueries({ queryKey: ['connect', 'conversations'] })).catch(() => {});
  }, [id, newest, cache]);

  async function memberAction(action: string, extra: object = {}) {
    try { await api.patch(`/connect/conversations/${id}/membership`, { action, ...extra }); await cache.invalidateQueries({ queryKey: ['connect'] }); }
    catch (e) { setError(errorText(e)); }
  }
  async function messageAction(message: number, action: string, extra: object = {}) {
    try { await api.patch(`/connect/conversations/${id}/messages/${message}`, { action, ...extra }); await cache.invalidateQueries({ queryKey: ['connect', 'messages', id] }); }
    catch (e) { setError(errorText(e)); }
  }

  if (!c) return <section className={`${panel} p-4`}>{conversation.error ? conversation.error.message : 'Loading conversation…'}</section>;

  const ordered = [...(messages.data ?? [])].reverse();

  return (
    <section className={`${panel} flex min-h-[650px] flex-col`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex min-w-0 items-center gap-3">
          <ConnectAvatar person={c.kind === 'direct' ? c.members.find((m) => m.id !== user?.id) ?? c.members[0] : { id: 0, name: c.name, active: false, department: null, photo_url: null, availability: '' }} size={38} showStatus={c.kind === 'direct'} />
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-bold text-strong">{c.name}</h2>
            <p className="text-xs text-muted">{c.members.length} members · {c.visibility}{c.archived ? ' · archived' : ''}</p>
          </div>
        </div>
        <div className="flex gap-0.5">
          {c.kind === 'direct' ? <Button variant="ghost" size="icon" aria-label="Call" title="Call" onClick={() => { void api.post('/connect/calls', { conversation_id: id }).then(() => cache.invalidateQueries({ queryKey: ['connect', 'calls'] })).catch((e) => setError(errorText(e))); }}><PhoneCall size={16} /></Button> : null}
          <Button variant="ghost" size="icon" aria-label="Members" title="Members" onClick={() => setMembersOpen(!membersOpen)}><Users size={16} /></Button>
          <Button variant="ghost" size="icon" aria-label={c.muted ? 'Unmute' : 'Mute'} title={c.muted ? 'Unmute' : 'Mute'} onClick={() => void memberAction('mute', { enabled: !c.muted })}>{c.muted ? <Bell size={16} /> : <BellOff size={16} />}</Button>
          <Button variant="ghost" size="icon" aria-label="Mark unread" title="Mark unread" onClick={() => void memberAction('unread')}><MailWarning size={16} /></Button>
          <Button variant="ghost" size="icon" aria-label={searchOpen ? 'Close search' : 'Search messages and files'} title={searchOpen ? 'Close search' : 'Search messages and files'} onClick={() => { if (searchOpen) { setSearch(''); setBefore(undefined); } setSearchOpen(!searchOpen); }}>{searchOpen ? <X size={16} /> : <Search size={16} />}</Button>
          <Button variant="ghost" size="icon" aria-label={pinned ? 'Show all messages' : 'Show pinned messages'} title={pinned ? 'Show all messages' : 'Show pinned messages'} onClick={() => { setPinned(!pinned); setBefore(undefined); }}><Pin size={16} className={pinned ? 'fill-teal text-teal' : ''} /></Button>
        </div>
      </header>

      {error ? <p role="alert" className="px-4 pt-2 text-sm text-danger">{error}</p> : null}
      {membersOpen ? <MemberPanel conversation={c} onAction={memberAction} /> : null}

      {searchOpen ? (
        <div className="relative border-b border-border p-3">
          <Search size={15} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-muted" />
          <Input autoFocus className="pl-9" aria-label="Search conversation messages and files" placeholder="Search messages and files" value={search} onChange={(e) => { setSearch(e.target.value); setBefore(undefined); }} />
        </div>
      ) : null}

      <div className="flex max-h-[55vh] min-h-64 flex-1 flex-col gap-1.5 overflow-auto bg-surface-soft/40 p-4" aria-live="polite">
        {messages.error ? <p role="alert" className="text-sm text-danger">{messages.error.message}</p> : null}
        {ordered.length === 0 ? <p className="py-12 text-center text-muted">No messages here yet.</p> : null}
        <div className="flex justify-center gap-2 pb-2">
          {messages.data?.length === 50 ? <Button variant="ghost" size="sm" onClick={() => setBefore(ordered[0]?.id)}>Older messages</Button> : null}
          {before ? <Button variant="ghost" size="sm" onClick={() => setBefore(undefined)}>Latest</Button> : null}
        </div>

        {ordered.map((m, i) => {
          const isMine = m.sender.id === user?.id;
          const deletable = Date.now() - new Date(m.created_at).getTime() < DELETE_WINDOW_MS;
          const showHeader = i === 0 || ordered[i - 1].sender.id !== m.sender.id;
          return (
            <div key={m.id} className={`group flex max-w-[72%] gap-2.5 ${isMine ? 'flex-row-reverse self-end' : 'self-start'}`}>
              <div className="w-7 shrink-0 self-end">{!isMine && showHeader ? <ConnectAvatar person={m.sender} size={28} /> : null}</div>
              <div className={`flex min-w-0 flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                {/* Own messages never get a name label — right alignment and the teal
                    bubble already say "you" without repeating it over every group. */}
                {showHeader && !isMine ? <strong className="px-1 text-xs text-muted">{m.sender.name}</strong> : null}
                {m.reply_to ? (
                  <div className="max-w-full border-l-2 border-border px-2 py-0.5 text-xs text-muted">
                    <strong className="text-muted">{m.reply_to.sender_name}: </strong>
                    {m.reply_to.voice_note ? 'Voice note' : m.reply_to.has_attachment ? 'Attachment' : m.reply_to.body ?? 'Message removed'}
                  </div>
                ) : null}
                <div className={`rounded-2xl px-3.5 py-2 text-sm ${isMine ? 'rounded-br-md bg-teal text-white' : 'rounded-bl-md border border-border bg-surface text-strong'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.deleted ? 'Message removed' : m.body}</p>
                  {m.mentions.length ? <p className={`mt-1 text-xs ${isMine ? 'text-white/80' : 'text-teal'}`}>Mentioned: {m.mentions.map((mid) => c.members.find((p) => p.id === mid)?.name ?? 'Former member').join(', ')}</p> : null}
                  {m.attachment ? <ConnectAttachment attachment={m.attachment} /> : null}
                </div>
                <div className={`flex items-center gap-1.5 px-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                  {m.pinned ? <Pin size={10} className="fill-teal text-teal" aria-label="Pinned" /> : null}
                  <span className="text-[10.5px] text-muted">{messageTimestamp(m.created_at)}</span>
                  {m.edited_at ? <span className="text-[10.5px] text-muted">· edited</span> : null}
                </div>
                {m.reactions.length > 0 ? (
                  <div className={`flex flex-wrap gap-1 ${isMine ? 'justify-end' : ''}`}>
                    {m.reactions.map((r) => {
                      const Icon = REACTION_ICONS[r.reaction as keyof typeof REACTION_ICONS];
                      return (
                        <button key={r.reaction} onClick={() => void messageAction(m.id, 'react', { reaction: r.reaction, enabled: !r.mine })} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${r.mine ? 'border-teal/30 bg-teal-light text-teal' : 'border-border bg-surface text-muted'}`}>
                          <Icon size={11} /> {r.count}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {!m.deleted ? (
                  // Hidden until this message is hovered (or a child gets focus, for
                  // keyboard use) — a grid-rows 0fr/1fr collapse, not just opacity, so
                  // the row takes no space and doesn't leave a permanent gap under
                  // every message the way an always-visible icon row did.
                  <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-150 group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr]">
                    <div className={`flex flex-wrap items-center gap-0.5 overflow-hidden ${isMine ? 'flex-row-reverse' : ''}`}>
                      <button aria-label="Reply" title="Reply" className="rounded p-1 text-muted hover:bg-surface hover:text-teal" onClick={() => setReply(m.id)}><Reply size={13} /></button>
                      {(Object.keys(REACTION_ICONS) as (keyof typeof REACTION_ICONS)[]).map((reaction) => {
                        const Icon = REACTION_ICONS[reaction];
                        const existing = m.reactions.find((r) => r.reaction === reaction);
                        return <button key={reaction} aria-label={REACTION_LABELS[reaction]} title={REACTION_LABELS[reaction]} className={`rounded p-1 hover:bg-surface ${existing?.mine ? 'text-teal' : 'text-muted'}`} onClick={() => void messageAction(m.id, 'react', { reaction, enabled: !existing?.mine })}><Icon size={13} /></button>;
                      })}
                      {isMine ? (
                        <>
                          <button aria-label="Edit message" title="Edit message" className="rounded p-1 text-muted hover:bg-surface hover:text-teal" onClick={() => { const body = window.prompt('Edit message', m.body ?? ''); if (body !== null) void messageAction(m.id, 'edit', { body }); }}><Pencil size={13} /></button>
                          <button
                            aria-label="Delete message"
                            title={deletable ? 'Delete message' : `You can only delete a message within ${DELETE_WINDOW_MS / 60000} minutes of sending`}
                            disabled={!deletable}
                            className="rounded p-1 text-muted hover:bg-surface hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
                            onClick={() => { if (window.confirm('Remove this message?')) void messageAction(m.id, 'delete'); }}
                          ><Trash2 size={13} /></button>
                        </>
                      ) : null}
                      {c.owner_id === user?.id || c.kind === 'direct' ? <button aria-label={m.pinned ? 'Unpin message' : 'Pin message'} title={m.pinned ? 'Unpin message' : 'Pin message'} className={`rounded p-1 hover:bg-surface ${m.pinned ? 'text-teal' : 'text-muted'}`} onClick={() => void messageAction(m.id, 'pin', { enabled: !m.pinned })}><Pin size={13} className={m.pinned ? 'fill-teal' : ''} /></button> : null}
                      <button aria-label="Report message" title="Report message" className="rounded p-1 text-muted hover:bg-surface hover:text-danger" onClick={() => { const reason = window.prompt('Why are you reporting this message?'); if (reason) void messageAction(m.id, 'report', { reason }); }}><Flag size={13} /></button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {c.archived ? (
        <p className="p-4 text-sm text-muted">This conversation is archived.</p>
      ) : (
        <Composer conversation={c} reply={reply} clearReply={() => setReply(null)} onSent={() => { setBefore(undefined); setSearch(''); setPinned(false); void cache.invalidateQueries({ queryKey: ['connect'] }); }} />
      )}
    </section>
  );
}

function MemberPanel({ conversation: c, onAction }: { conversation: Conversation; onAction: (action: string, data?: object) => Promise<void> }) {
  const { session } = useAuth();
  const user = session?.user;
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const isOwner = c.owner_id === user?.id;
  // Adding someone to a direct conversation is how it becomes a group (see
  // ConnectChatController@membership) — either participant can do that, there
  // being no real "owner" of a 1:1; every other member-management action stays
  // owner-only once it's an actual group.
  const canAddMembers = c.kind === 'direct' || isOwner;
  const departments = useDepartmentOptions();
  const people = useQuery({
    queryKey: ['connect', 'member-search', search, departmentId, page],
    queryFn: () => api.get<Page<Person>>('/connect/colleagues', { params: { search, department_id: departmentId ?? undefined, page } }),
    enabled: canAddMembers,
  });
  const departmentOptions = [{ value: '', label: 'All departments' }, ...(departments.data ?? []).map((d) => ({ value: String(d.id), label: d.name }))];
  if (!user) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-surface-soft p-4">
      <p className="text-xs text-muted">New members can read existing history. Removed members lose conversation and attachment access.</p>
      {c.members.map((p) => (
        <div className="flex items-center gap-2.5 py-1" key={p.id}>
          <ConnectAvatar person={p} size={30} showStatus />
          <span className="flex-1 text-sm text-strong">{p.name} · <span className="text-muted">{p.active ? p.availability : 'inactive'}</span></span>
          {isOwner && p.id !== user.id && c.kind !== 'direct' ? (
            <>
              <Button variant="ghost" size="icon" aria-label={`Make ${p.name} owner`} title={`Make ${p.name} owner`} onClick={() => void onAction('transfer', { user_id: p.id })}><Crown size={15} /></Button>
              <Button variant="ghost" size="icon" aria-label={`Remove ${p.name}`} title={`Remove ${p.name}`} onClick={() => void onAction('remove', { user_id: p.id })}><UserMinus size={15} /></Button>
            </>
          ) : null}
        </div>
      ))}
      {canAddMembers ? (
        <>
          {c.kind === 'direct' ? <p className="text-xs text-muted">Adding someone turns this into a group, visible to everyone in it.</p> : null}
          <div className="mt-1 flex items-center gap-2">
            <Input className="flex-1" value={search} placeholder="Find a colleague to add" onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <div className="w-40"><SelectMenu value={departmentId ?? ''} onChange={(value) => { setDepartmentId(value || null); setPage(1); }} options={departmentOptions} /></div>
          </div>
          {people.data?.data.filter((p) => !c.members.some((m) => m.id === p.id)).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 py-1">
              <span className="flex items-center gap-2.5 text-sm text-strong"><ConnectAvatar person={p} size={28} />{p.name}</span>
              <Button variant="ghost" size="icon" aria-label={`Add ${p.name}`} title={`Add ${p.name}`} onClick={() => void onAction('add', { user_id: p.id })}><UserPlus size={15} /></Button>
            </div>
          ))}
          <Pager page={page} hasNext={!people.data || page < people.data.last_page} onChange={setPage} />
        </>
      ) : null}
      {isOwner && c.kind !== 'direct' ? (
        <div className="flex gap-1 pt-1">
          <Button variant="ghost" size="icon" aria-label="Rename conversation" title="Rename conversation" onClick={() => { const name = window.prompt('Conversation name', c.name); if (name) void onAction('rename', { name }); }}><Pencil size={15} /></Button>
          <Button variant="ghost" size="icon" aria-label={c.archived ? 'Reopen conversation' : 'Archive conversation'} title={c.archived ? 'Reopen conversation' : 'Archive conversation'} onClick={() => void onAction('archive', { enabled: !c.archived })}>{c.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}</Button>
        </div>
      ) : !isOwner && c.kind !== 'direct' ? (
        <Button variant="ghost" size="icon" aria-label="Leave conversation" title="Leave conversation" onClick={() => void onAction('leave')}><LogOut size={15} /></Button>
      ) : null}
    </div>
  );
}

function Composer({ conversation, reply, clearReply, onSent }: { conversation: Conversation; reply: number | null; clearReply: () => void; onSent: () => void }) {
  const { session } = useAuth();
  const selfId = session?.user?.id;
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [voice, setVoice] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const clientId = useRef(crypto.randomUUID());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // @mention autocomplete — replaces a separate "Mention colleagues" picker.
  // Only triggers on an unfinished "@word" at the end of what's typed so far
  // (the same rule every chat app uses: a space ends it), filtered to this
  // conversation's own members since mentioning anyone else is meaningless.
  // Direct messages have exactly one other member, who already sees every
  // message by definition, so mentions don't apply there at all.
  const atMatch = conversation.kind === 'direct' ? null : /@(\w*)$/.exec(body);
  const mentionQuery = atMatch ? atMatch[1].toLowerCase() : null;
  // Derived from the live text rather than accumulated as its own state — a
  // separately-tracked list kept growing even after someone backspaced an
  // "@Name" back out of the message, so a stale mention (and its "you were
  // mentioned" notification) could ride along on unrelated text.
  const mentions = useMemo(
    () => conversation.kind === 'direct'
      ? []
      : conversation.members.filter((p) => p.id !== selfId && body.includes('@' + p.name.split(' ')[0])).map((p) => p.id),
    [body, conversation.members, conversation.kind, selfId],
  );
  const mentionMatches = mentionQuery === null ? [] : conversation.members.filter((p) => p.id !== selfId && p.name.toLowerCase().includes(mentionQuery) && !mentions.includes(p.id));

  function pickMention(person: Person) {
    setBody(body.slice(0, atMatch!.index) + '@' + person.name.split(' ')[0] + ' ');
  }

  useEffect(() => {
    if (!file || !voice) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => { URL.revokeObjectURL(url); setPreview(null); };
  }, [file, voice]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current) { recorder.current.onstop = null; if (recorder.current.state !== 'inactive') recorder.current.stop(); }
    stream.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const send = useMutation({
    mutationFn: () => {
      const data = new FormData();
      data.append('client_id', clientId.current);
      data.append('body', body);
      data.append('voice_note', voice ? '1' : '0');
      if (reply) data.append('reply_to_id', String(reply));
      mentions.forEach((id) => data.append('mentions[]', String(id)));
      if (file) data.append('file', file);
      return api.post(`/connect/conversations/${conversation.id}/messages`, data);
    },
    onSuccess: () => { setBody(''); setFile(null); setVoice(false); clearReply(); clientId.current = crypto.randomUUID(); onSent(); },
  });

  async function record() {
    try {
      if (recording) { recorder.current?.stop(); return; }
      const source = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.current = source;
      const r = new MediaRecorder(source);
      recorder.current = r;
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      r.onstop = () => {
        source.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (timer.current) clearTimeout(timer.current);
        const mime = r.mimeType || 'audio/webm';
        const blob = new File(chunks, mime.includes('mp4') ? 'voice-note.m4a' : 'voice-note.webm', { type: mime });
        if (blob.size > 10 * 1024 * 1024) { setError('Voice note exceeds 10 MB. Record a shorter note.'); return; }
        setFile(blob);
        setVoice(true);
      };
      r.start();
      setRecording(true);
      timer.current = setTimeout(() => { if (r.state === 'recording') r.stop(); }, 120000);
    } catch (e) { stream.current?.getTracks().forEach((t) => t.stop()); setError(errorText(e)); }
  }

  return (
    <form className="flex flex-col gap-2 border-t border-border p-4" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
      {reply ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          Replying to a message
          <button type="button" aria-label="Cancel reply" title="Cancel reply" className="rounded p-0.5 hover:text-danger" onClick={clearReply}><X size={13} /></button>
        </p>
      ) : null}
      {mentionMatches.length > 0 ? (
        <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-sm">
          {mentionMatches.map((p) => (
            <button key={p.id} type="button" onClick={() => pickMention(p)} className="flex items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-surface-soft">
              <ConnectAvatar person={p} size={26} />
              <span className="text-sm text-strong">{p.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      {preview ? <audio src={preview} controls className="h-9" /> : null}
      {file ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          {file.name}
          <button type="button" aria-label="Remove attachment" title="Remove attachment" className="rounded p-0.5 hover:text-danger" onClick={() => { setFile(null); setVoice(false); }}><X size={13} /></button>
        </p>
      ) : null}

      <div className="flex items-end gap-1.5 rounded-2xl border border-border bg-surface-soft p-1.5 pl-3">
        <label aria-label="Attach a file" title="Attach a file" className="flex h-8 w-8 cursor-pointer shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-strong">
          <Paperclip size={16} />
          <input type="file" className="sr-only" disabled={recording || send.isPending} accept="image/jpeg,image/png,image/webp,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,audio/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f && f.size <= 10 * 1024 * 1024) { setFile(f); setVoice(false); } else if (f) setError('Choose a file no larger than 10 MB.'); }} />
        </label>
        <textarea
          aria-label="Message"
          placeholder="Write a message…"
          maxLength={10000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={send.isPending}
          rows={1}
          className="min-h-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-strong placeholder:text-muted focus:outline-none disabled:text-muted"
        />
        <Button type="button" variant="ghost" size="icon" aria-label={recording ? 'Stop recording' : 'Record a voice note'} title={recording ? 'Stop recording' : 'Record a voice note'} disabled={send.isPending} onClick={() => void record()}><Mic size={16} className={recording ? 'fill-danger text-danger' : ''} /></Button>
        <Button variant="primary" size="icon" aria-label={send.isPending ? 'Sending' : send.isError ? 'Retry send' : 'Send'} title={send.isPending ? 'Sending' : send.isError ? 'Retry send' : 'Send'} isLoading={send.isPending} disabled={recording || send.isPending || (!body.trim() && !file)}><Send size={15} /></Button>
      </div>
      {error || send.error ? <p role="alert" className="text-sm text-danger">{error || send.error?.message}</p> : null}
    </form>
  );
}

function CallHistory() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['connect', 'call-history', page], queryFn: () => api.get<{ calls: Page<VoiceCall>; media_ready: boolean }>('/connect/calls', { params: { page } }), refetchInterval: 10000 });
  return (
    <div className={`${panel} p-2`}>
      <h2 className="px-3 pt-2 font-display font-bold text-strong">Voice call history</h2>
      {query.data && !query.data.media_ready ? <p className="px-3 text-sm text-muted">Live audio is awaiting media-service configuration. Messaging and voice notes are available.</p> : null}
      {query.error ? <p role="alert" className="px-3 text-sm text-danger">{query.error.message}</p> : null}
      {query.data?.calls.data.map((c) => {
        const person = c.incoming ? c.caller : c.callee;
        return (
          <div key={c.id} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0">
            <ConnectAvatar person={person} size={38} />
            <span className="flex-1">
              <strong className="block text-sm text-strong">{person.name}</strong>
              <small className="text-xs text-muted">{new Date(c.created_at).toLocaleString()}</small>
            </span>
            <span className={`text-xs font-semibold capitalize ${c.status === 'missed' ? 'text-danger' : c.status === 'ended' || c.status === 'accepted' ? 'text-success' : 'text-muted'}`}>{c.status}</span>
          </div>
        );
      })}
      <Pager page={page} hasNext={!query.data || page < query.data.calls.last_page} onChange={setPage} />
    </div>
  );
}

function Preferences() {
  const { hasPermission } = useAuth();
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['connect', 'preferences'], queryFn: () => api.get<{ availability: string; notifications: boolean; allow_calls: boolean }>('/connect/preferences') });
  const save = useMutation({ mutationFn: (data: object) => api.patch('/connect/preferences', data), onSuccess: () => cache.invalidateQueries({ queryKey: ['connect', 'preferences'] }) });
  return (
    <div className="space-y-4">
      <section className={`${panel} max-w-md space-y-4 p-5`}>
        <h2 className="font-display font-bold text-strong">Your Connect preferences</h2>
        {query.data ? (
          <>
            <label className="block space-y-1.5 text-sm font-medium text-muted">
              Availability
              <select value={query.data.availability} onChange={(e) => save.mutate({ availability: e.target.value })} className="block w-full rounded-lg border border-border bg-surface p-2.5 text-sm text-strong">
                {['available', 'away', 'busy', 'offline'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-strong"><input type="checkbox" checked={query.data.notifications} onChange={(e) => save.mutate({ notifications: e.target.checked })} /> Activity notifications</label>
            <label className="flex items-center gap-2.5 text-sm text-strong"><input type="checkbox" checked={query.data.allow_calls} onChange={(e) => save.mutate({ allow_calls: e.target.checked })} /> Allow incoming voice calls</label>
          </>
        ) : null}
        {save.error || query.error ? <p role="alert" className="text-sm text-danger">{save.error?.message || query.error?.message}</p> : null}
      </section>
      {hasPermission('organizations.administer') ? <Reports /> : null}
    </div>
  );
}

function Reports() {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['connect', 'reports', page], queryFn: () => api.get<Page<{ id: number; body: string | null; reason: string; status: string }>>('/connect/reports', { params: { page } }) });
  return (
    <section className={`${panel} space-y-3 p-5`}>
      <h2 className="font-display font-bold text-strong">Reported messages</h2>
      <p className="text-sm text-muted">Only reported excerpts are shown. Private conversations remain membership-only.</p>
      {error || query.error ? <p role="alert" className="text-sm text-danger">{error || query.error?.message}</p> : null}
      {query.data?.data.map((r) => (
        <article key={r.id} className="space-y-2 border-b border-border py-3 last:border-0">
          <p className="whitespace-pre-wrap text-sm text-strong">{r.body ?? 'Message removed'}</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted">Report: {r.reason} · {r.status}</p>
            {r.status === 'open' ? (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" aria-label="Hide message" title="Hide message" onClick={() => { const reason = window.prompt('Reason for this moderation decision'); if (reason) void api.patch(`/connect/reports/${r.id}`, { action: 'hide', reason }).then(() => cache.invalidateQueries({ queryKey: ['connect'] })).catch((e) => setError(errorText(e))); }}><Ban size={15} /></Button>
                <Button variant="ghost" size="icon" aria-label="Dismiss report" title="Dismiss report" onClick={() => { const reason = window.prompt('Reason for this moderation decision'); if (reason) void api.patch(`/connect/reports/${r.id}`, { action: 'dismiss', reason }).then(() => cache.invalidateQueries({ queryKey: ['connect'] })).catch((e) => setError(errorText(e))); }}><Check size={15} /></Button>
              </div>
            ) : null}
          </div>
        </article>
      ))}
      <Pager page={page} hasNext={!query.data || page < query.data.last_page} onChange={setPage} />
    </section>
  );
}
