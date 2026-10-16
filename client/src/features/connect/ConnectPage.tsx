import { lazy, Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Plus, Video, Users } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

const MeetingRoom = lazy(() => import('./MeetingRoom'));
type Person = { id: number; name: string };
export type Meeting = { id: string; title: string; description: string | null; status: 'scheduled' | 'live' | 'ended' | 'cancelled'; starts_at: string; ends_at: string; is_host: boolean; host: Person; members: Person[]; room_close_pending: boolean };
type Page<T> = { data: T[]; current_page: number; last_page: number };
type JoinCredentials = { token: string; server_url: string };
const panel = 'rounded-xl border border-border bg-surface p-5 space-y-4';
const date = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export function ConnectPage() {
  const { moduleByKey } = useAuth();
  const { id } = useParams();
  return <>
    <PageHeader title="Connect" subtitle="A shared space to meet, talk and work together." />
    {moduleByKey('connect')?.visibility !== 'enabled' ? <section className={panel}>Connect is not enabled for your workspace. Your administrator can enable the Connect module.</section> : id ? <MeetingDetail key={id} id={id} /> : <MeetingList />}
  </>;
}

function Failure({ error, retry }: { error: Error; retry: () => void }) {
  return <div role="alert" className={panel}><p>{error.message}</p><Button onClick={retry}>Try again</Button></div>;
}

function MeetingList() {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: ['connect', 'meetings', page], queryFn: () => api.get<{ meetings: Page<Meeting>; media_ready: boolean }>('/connect/meetings', { params: { page } }), refetchInterval: 15000 });
  return <div className="space-y-6">
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-pine p-6 text-white">
      <div><h2 className="font-display text-xl font-bold">Bring your people together</h2><p className="mt-2 text-sm opacity-80">Private meetings for invited colleagues. Up to 25 people.</p></div>
      <Button variant="onHero" onClick={() => setCreating(!creating)}><Plus size={16} />{creating ? 'Close form' : 'New meeting'}</Button>
    </section>
    {query.data && !query.data.media_ready ? <p role="status" className="rounded-lg border border-border bg-surface-soft p-4 text-sm">You can schedule meetings now. Live calls will become available when your administrator finishes the meeting service setup.</p> : null}
    {creating ? <MeetingForm /> : null}
    <h2 className="font-display text-lg font-bold">Your meetings</h2>
    {query.isError ? <Failure error={query.error} retry={() => void query.refetch()} /> : query.isPending ? <p role="status">Loading meetings…</p> : query.data.meetings.data.length === 0 ? <section className={`${panel} text-center`}><Video className="mx-auto text-muted" size={32} /><h3 className="font-bold">Your next conversation starts here</h3><p className="text-sm text-muted">Create a meeting or find invitations from your colleagues here.</p></section> : <div className="grid gap-4 md:grid-cols-2">{query.data.meetings.data.map((meeting) => <Link key={meeting.id} to={`/connect/${meeting.id}`} className={`${panel} block transition hover:border-teal`}>
      <div className="flex items-center justify-between gap-2"><Video size={20} /><span className="rounded-full bg-surface-soft px-3 py-1 text-xs capitalize">{meeting.status}</span></div>
      <h3 className="break-words font-display text-lg font-bold">{meeting.title}</h3><p className="text-sm text-muted">Hosted by {meeting.is_host ? 'you' : meeting.host.name}</p>
      <p className="flex items-center gap-2 text-sm"><CalendarDays size={15} />{date(meeting.starts_at)}</p><p className="flex items-center gap-2 text-sm text-muted"><Users size={15} />{meeting.members.length} invited</p>
    </Link>)}</div>}
    {query.data && query.data.meetings.last_page > 1 ? <div className="flex items-center gap-4"><Button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page}</span><Button disabled={page >= query.data.meetings.last_page} onClick={() => setPage(page + 1)}>Next</Button></div> : null}
  </div>;
}

function MeetingForm() {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState(60);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState<Person[]>([]);
  const people = useQuery({ queryKey: ['connect', 'people', search, page], queryFn: () => api.get<Page<Person>>('/connect/people', { params: { search, page } }) });
  const create = useMutation({ mutationFn: () => api.post<{ data: Meeting }>('/connect/meetings', { title: title.trim(), description, member_ids: members.map((p) => p.id), starts_at: scheduled ? new Date(start).toISOString() : null, duration_minutes: duration }), onSuccess: async ({ data }) => { await cache.invalidateQueries({ queryKey: ['connect'] }); navigate(`/connect/${data.id}`); } });
  return <form className={panel} onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
    <h2 className="font-display text-lg font-bold">New meeting</h2>
    <label className="block space-y-2 text-sm">Meeting title<Input required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are we getting together for?" /></label>
    <label className="block space-y-2 text-sm">Agenda (optional)<Textarea maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={scheduled} onChange={(e) => setScheduled(e.target.checked)} />Schedule for later</label>
    <div className="grid gap-4 sm:grid-cols-2">{scheduled ? <label className="block space-y-2 text-sm">Start time — {Intl.DateTimeFormat().resolvedOptions().timeZone}<Input type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} /></label> : null}
      <label className="block space-y-2 text-sm">Duration (minutes)<Input type="number" min={15} max={480} required value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label></div>
    <label className="block space-y-2 text-sm">Invite colleagues<Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search colleagues by name" /></label>
    <div className="flex flex-wrap gap-2">{members.map((person) => <Button type="button" key={person.id} size="sm" onClick={() => setMembers(members.filter((p) => p.id !== person.id))} aria-label={`Remove ${person.name}`}>{person.name} ×</Button>)}</div>
    {people.isError ? <Failure error={people.error} retry={() => void people.refetch()} /> : people.isPending ? <p>Loading colleagues…</p> : <div className="max-h-48 space-y-2 overflow-auto">{people.data.data.map((person) => <label className="flex items-center gap-3 rounded p-2 hover:bg-surface-soft" key={person.id}><input type="checkbox" checked={members.some((p) => p.id === person.id)} disabled={members.length >= 24 && !members.some((p) => p.id === person.id)} onChange={(e) => setMembers(e.target.checked ? [...members, person] : members.filter((p) => p.id !== person.id))} />{person.name}</label>)}{people.data.data.length === 0 ? <p>No colleagues match your search.</p> : null}</div>}
    {people.data && people.data.last_page > 1 ? <div className="flex gap-3"><Button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><Button type="button" disabled={page >= people.data.last_page} onClick={() => setPage(page + 1)}>More colleagues</Button></div> : null}
    <p className="text-sm text-muted">{members.length}/24 colleagues selected. Invitations appear in their Valtireo inbox. Only invited colleagues can join.</p>
    {create.isError ? <p role="alert" className="text-danger">{create.error.message}</p> : null}
    <Button type="submit" variant="primary" disabled={!title.trim() || members.length === 0 || create.isPending}>{create.isPending ? 'Creating…' : scheduled ? 'Schedule meeting' : 'Create meeting'}</Button>
  </form>;
}

function MeetingDetail({ id }: { id: string }) {
  const cache = useQueryClient();
  const toast = useToast();
  const [credentials, setCredentials] = useState<JoinCredentials | null>(null);
  const [mediaError, setMediaError] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const query = useQuery({ queryKey: ['connect', id], queryFn: () => api.get<{ data: Meeting; media_ready: boolean }>(`/connect/meetings/${id}`), refetchInterval: 5000 });
  const join = useMutation({ mutationFn: () => api.post<JoinCredentials>(`/connect/meetings/${id}/join`), onSuccess: (data) => { setMediaError(''); setCredentials(data); void cache.invalidateQueries({ queryKey: ['connect', id] }); } });
  const end = useMutation({ mutationFn: () => api.post(`/connect/meetings/${id}/end`), onSuccess: () => { setCredentials(null); setConfirmEnd(false); toast.success('Meeting closed'); }, onSettled: () => cache.invalidateQueries({ queryKey: ['connect'] }) });
  if (query.isPending) return <p>Loading meeting…</p>;
  if (query.isError) return <Failure error={query.error} retry={() => void query.refetch()} />;
  const meeting = query.data.data;
  const closed = meeting.status === 'ended' || meeting.status === 'cancelled';
  const inWindow = Date.now() >= new Date(meeting.starts_at).getTime() - 15 * 60_000 && Date.now() < new Date(meeting.ends_at).getTime();
  return <div className="space-y-5">
    <Link to="/connect" className="text-sm text-teal underline">← All meetings</Link>
    <section className={panel}>
      <div className="flex flex-wrap justify-between gap-3"><h2 className="break-words font-display text-2xl font-bold">{meeting.title}</h2><span className="capitalize text-muted">{meeting.status}</span></div>
      <p className="text-sm text-muted">{date(meeting.starts_at)} – {date(meeting.ends_at)} · Hosted by {meeting.host.name}</p>
      {meeting.description ? <p className="whitespace-pre-wrap break-words">{meeting.description}</p> : null}
      <p className="text-sm"><strong>Invited:</strong> {meeting.members.map((p) => p.name).join(', ')}</p>
      {!query.data.media_ready ? <p role="status">Live calls are awaiting meeting service setup.</p> : null}
      {!closed && !inWindow ? <p className="text-sm text-muted">Joining opens 15 minutes before the start and closes at the scheduled end.</p> : null}
      {!closed && meeting.status === 'scheduled' && !meeting.is_host ? <p role="status">Waiting for the host to start the meeting. This page updates automatically.</p> : null}
      <div className="flex flex-wrap gap-3">
        {!closed && !credentials ? <Button variant="primary" disabled={!query.data.media_ready || !inWindow || join.isPending || (!meeting.is_host && meeting.status !== 'live')} onClick={() => join.mutate()}><Video size={16} />{join.isPending ? 'Connecting…' : meeting.is_host && meeting.status === 'scheduled' ? 'Start meeting' : 'Join meeting'}</Button> : null}
        {meeting.is_host && (!closed || meeting.room_close_pending) ? <Button variant="danger" onClick={() => setConfirmEnd(true)}>{meeting.room_close_pending ? 'Retry closing live room' : meeting.status === 'scheduled' ? 'Cancel meeting' : 'End for everyone'}</Button> : null}
      </div>
      <p className="text-xs text-muted">You join with your microphone and camera off. Enable them when you are ready. Meeting chat is temporary and is not saved as a company conversation.</p>
      {confirmEnd ? <div className="space-y-3 rounded border border-border p-4"><p>{meeting.status === 'scheduled' ? 'Cancel this invitation?' : 'End this meeting and disconnect everyone?'}</p><div className="flex gap-3"><Button variant="danger" disabled={end.isPending} onClick={() => end.mutate()}>{end.isPending ? 'Closing…' : 'Confirm'}</Button><Button onClick={() => setConfirmEnd(false)}>Keep meeting</Button></div></div> : null}
      {join.isError || end.isError || mediaError ? <p role="alert" className="text-danger">{mediaError || end.error?.message || join.error?.message}</p> : null}
    </section>
    {credentials && !closed ? <Suspense fallback={<p>Preparing meeting controls…</p>}><MeetingRoom credentials={credentials} onLeave={() => setCredentials(null)} onError={(message) => { setMediaError(message); setCredentials(null); }} /></Suspense> : null}
  </div>;
}
