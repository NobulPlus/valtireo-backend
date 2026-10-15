import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/apiClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

type Person = { id: number; name: string };
type Preferences = { share_birthday: boolean; share_anniversary: boolean; receive_appreciation: boolean; allow_shared_appreciation: boolean; appreciation_notifications: boolean };
type Features = { milestones_enabled: boolean; appreciation_enabled: boolean };
type Settings = { preferences: Preferences; features: Features };
type Appreciation = { id: number; sender: Person; recipient: Person; message: string; visibility: 'private' | 'shared'; created_at: string; reports?: { id: number; reason: string }[] };
type Page<T> = { data: T[]; current_page: number; last_page: number; total: number };
const panel = 'rounded-xl border border-border bg-surface p-5 space-y-4';
const labels: Record<keyof Preferences, string> = {
  appreciation_notifications: 'Show in-app appreciation alerts (no email or push)',
  share_birthday: 'Show my birthday (day and month only)',
  share_anniversary: 'Celebrate my work anniversary',
  receive_appreciation: 'Allow colleagues to send me appreciation',
  allow_shared_appreciation: 'Allow appreciation to be shared with colleagues',
};

function Pages({ page, last, setPage, disabled }: { page: number; last: number; setPage: (page: number) => void; disabled?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><Button type="button" variant="secondary" disabled={page <= 1 || disabled} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm text-muted">Page {page} of {Math.max(last, 1)}</span><Button type="button" variant="secondary" disabled={page >= last || disabled} onClick={() => setPage(page + 1)}>Next</Button></div>;
}

function Failure({ retry }: { retry: () => void }) {
  return <div role="alert" className="text-sm text-danger">Could not load this section. <button className="underline" onClick={retry}>Retry</button></div>;
}

export function LifestylePage() {
  const { moduleByKey, hasPermission } = useAuth();
  const enabled = moduleByKey('employee_self_service')?.visibility === 'enabled';
  return <>
    <PageHeader title="Life at work" subtitle="Celebrate milestones and thank the people who make a difference." actions={hasPermission('workspace_settings.update') ? <Link to="/settings/lifestyle" className="text-sm text-teal underline">Manage lifestyle</Link> : undefined} />
    {enabled ? <EmployeeLifestyle /> : <p>Employee self-service is not available in your workspace.</p>}
  </>;
}

function EmployeeLifestyle() {
  const client = useQueryClient();
  const toast = useToast();
  const [scope, setScope] = useState('all');
  const [page, setPage] = useState(1);
  const [recipientPage, setRecipientPage] = useState(1);
  const [search, setSearch] = useState('');
  const [recipient, setRecipient] = useState<(Person & { allow_shared_appreciation: boolean }) | null>(null);
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [reportId, setReportId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const settings = useQuery({ queryKey: ['lifestyle', 'preferences'], queryFn: () => api.get<Settings>('/lifestyle/preferences') });
  const milestones = useQuery({ queryKey: ['lifestyle', 'milestones'], enabled: settings.data?.features.milestones_enabled === true, queryFn: () => api.get<{ data: { employee: Person; type: string; date: string; years_of_service?: number }[] }>('/lifestyle/milestones') });
  const feed = useQuery({ queryKey: ['lifestyle', 'feed', scope, page], enabled: settings.data?.features.appreciation_enabled === true, queryFn: () => api.get<Page<Appreciation>>('/lifestyle/appreciations', { params: { scope, page, per_page: 20 } }) });
  const recipients = useQuery({ queryKey: ['lifestyle', 'recipients', search, recipientPage], enabled: settings.data?.features.appreciation_enabled === true, queryFn: () => api.get<Page<Person & { allow_shared_appreciation: boolean }>>('/lifestyle/appreciation-recipients', { params: { search: search || undefined, page: recipientPage, per_page: 25 } }) });
  const me = useQuery({ queryKey: ['lifestyle', 'employee-id'], queryFn: () => api.get<{ employee: { id: number } }>('/dashboard/me') });
  const action = useMutation({
    mutationFn: async ({ path, body, method = 'post' }: { path: string; body?: unknown; method?: 'post' | 'patch' | 'delete' }) => method === 'delete' ? api.delete<unknown>(path) : api[method]<unknown>(path, body),
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: ['lifestyle'] });
      client.removeQueries({ queryKey: ['lifestyle', 'feed'] });
      await client.invalidateQueries({ queryKey: ['lifestyle'] });
    },
    onError: (error) => toast.error('Could not save', error.message),
  });
  if (settings.isError) return <Failure retry={() => void settings.refetch()} />;
  if (!settings.data) return <p role="status">Loading your preferences…</p>;
  const flags = settings.data.features;
  return <div className="space-y-6">
    <section className={panel} aria-labelledby="privacy-title">
      <h2 id="privacy-title" className="font-display text-lg font-bold">Your privacy, your choice</h2>
      <p className="text-sm text-muted">Participation is optional. Shared milestones and appreciation are visible to active colleagues in your organization. Turning off shared appreciation makes existing messages private; enabling it again does not republish them.</p>
      <div className="grid gap-3 sm:grid-cols-2">{(Object.keys(labels) as (keyof Preferences)[]).map((key) => <label key={key} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.data.preferences[key]} disabled={action.isPending} onChange={(event) => action.mutate({ path: '/lifestyle/preferences', method: 'patch', body: { [key]: event.target.checked } })} />{labels[key]}</label>)}</div>
    </section>
    <section className={panel}><h2 className="font-display text-lg font-bold">Upcoming milestones</h2>
      {!flags.milestones_enabled ? <p className="text-sm text-muted">Your organization has not enabled milestones yet.</p> : milestones.isError ? <Failure retry={() => void milestones.refetch()} /> : milestones.isPending ? <p>Loading milestones…</p> : milestones.data?.data.length ? <ul className="divide-y divide-border">{milestones.data.data.map((item) => <li className="flex flex-wrap justify-between gap-2 py-3" key={`${item.employee.id}-${item.type}-${item.date}`}><span className="font-medium">{item.employee.name}</span><span className="text-sm text-muted">{item.type === 'birthday' ? 'Birthday' : `${item.years_of_service} years with us`} · {item.date}</span></li>)}</ul> : <p className="text-sm text-muted">No shared milestones in the next 30 days.</p>}
    </section>
    {!flags.appreciation_enabled ? <section className={panel}><h2 className="font-bold">Appreciation</h2><p>Your organization has not enabled appreciation yet.</p></section> : <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)]">
      <section className={panel}><h2 className="font-display text-lg font-bold">Appreciation</h2><label className="block text-sm">Show <select aria-label="Appreciation filter" className="ml-2 rounded border border-border bg-surface p-2" value={scope} onChange={(e) => { setScope(e.target.value); setPage(1); }}>{['all', 'received', 'sent', 'shared'].map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
        {feed.isError ? <Failure retry={() => void feed.refetch()} /> : feed.isPending ? <p>Loading appreciation…</p> : !feed.data?.data.length ? <p className="text-sm text-muted">No messages here yet.</p> : feed.data.data.map((item) => <article key={item.id} className="space-y-3 rounded-lg border border-border p-4"><p className="text-sm font-semibold">{item.sender.name} → {item.recipient.name}</p><p className="whitespace-pre-wrap break-words">{item.message}</p><p className="text-xs text-muted">{item.visibility === 'private' ? 'Private · participants only' : 'Shared with colleagues'} · {new Date(item.created_at).toLocaleDateString()}</p><div className="flex gap-3">
          {[item.sender.id, item.recipient.id].includes(me.data?.employee.id ?? -1) ? <Button variant="secondary" disabled={action.isPending} onClick={() => { if (window.confirm('Remove this message from employee feeds?')) action.mutate({ path: `/lifestyle/appreciations/${item.id}`, method: 'delete' }); }}>Remove</Button> : null}
          {item.sender.id !== me.data?.employee.id ? <Button variant="secondary" onClick={() => { setReportId(item.id); setReason(''); }}>Report</Button> : null}
        </div></article>)}
        <Pages page={page} last={feed.data?.last_page ?? 1} setPage={setPage} disabled={feed.isFetching} />
      </section>
      <form className={panel} onSubmit={async (event) => { event.preventDefault(); if (!recipient) return; try { await action.mutateAsync({ path: '/lifestyle/appreciations', body: { recipient_employee_id: recipient.id, message: message.trim(), visibility: recipient.allow_shared_appreciation ? visibility : 'private' } }); setMessage(''); setRecipient(null); setVisibility('private'); setScope('sent'); setPage(1); toast.success('Appreciation sent'); } catch { /* mutation displays the error and preserves the draft */ } }}>
        <h2 className="font-display text-lg font-bold">Say thank you</h2>
        <label className="block space-y-2 text-sm"><span>Find a colleague</span><Input value={search} onChange={(e) => { setSearch(e.target.value); setRecipientPage(1); }} placeholder="Search names" /></label>
        {recipient ? <p className="text-sm font-semibold">Selected: {recipient.name}</p> : null}
        {recipients.isError ? <Failure retry={() => void recipients.refetch()} /> : recipients.isPending ? <p>Loading colleagues…</p> : <div className="max-h-52 space-y-1 overflow-auto">{recipients.data?.data.map((person) => <button type="button" aria-pressed={recipient?.id === person.id} key={person.id} className={`block w-full rounded p-2 text-left text-sm ${recipient?.id === person.id ? 'bg-surface-soft font-bold' : 'hover:bg-surface-soft'}`} onClick={() => { setRecipient(person); setVisibility('private'); }}>{person.name}</button>)}{!recipients.data?.data.length ? <p className="text-sm text-muted">No opted-in colleagues match this search.</p> : null}</div>}
        <Pages page={recipientPage} last={recipients.data?.last_page ?? 1} setPage={setRecipientPage} disabled={recipients.isFetching} />
        <label className="block space-y-2 text-sm"><span>Your message</span><Textarea required maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Thank you for…" /></label>
        <label className="block space-y-2 text-sm"><span>Visibility</span><select className="block w-full rounded border border-border bg-surface p-2" value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="private">Private — you and your colleague</option><option disabled={!recipient?.allow_shared_appreciation} value="shared">Shared — colleagues in your organization</option></select></label>
        <Button type="submit" disabled={!recipient || !message.trim() || action.isPending}>Send appreciation</Button>
      </form>
    </div>}
    {reportId !== null ? <section className={panel} aria-label="Report appreciation"><h2 className="font-bold">Report this message</h2><p className="text-sm text-muted">This shares the message, including private messages, with your organization moderator.</p><label className="block text-sm">Reason<Textarea maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label><div className="flex gap-3"><Button disabled={!reason.trim() || action.isPending} onClick={async () => { try { await action.mutateAsync({ path: `/lifestyle/appreciations/${reportId}/report`, body: { reason: reason.trim() } }); setReportId(null); toast.success('Report submitted'); } catch { /* preserve report */ } }}>Submit report</Button><Button variant="secondary" onClick={() => setReportId(null)}>Cancel</Button></div></section> : null}
  </div>;
}

export function LifestyleAdminPage() {
  const { hasPermission, moduleByKey } = useAuth();
  return <><PageHeader title="Lifestyle controls" subtitle="Enable optional employee experiences and review reported appreciation." />{hasPermission('workspace_settings.update') && moduleByKey('employee_self_service')?.visibility === 'enabled' ? <LifestyleAdmin /> : <p>Organization administration and employee self-service access are required.</p>}</>;
}

function LifestyleAdmin() {
  const client = useQueryClient();
  const toast = useToast();
  const { refresh } = useAuth();
  const [page, setPage] = useState(1);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const workspace = useQuery({ queryKey: ['lifestyle', 'workspace'], queryFn: () => api.get<{ workspace: { lifestyle: Features } }>('/workspace') });
  const reports = useQuery({ queryKey: ['lifestyle', 'reports', page], queryFn: () => api.get<Page<Appreciation>>('/lifestyle/reports', { params: { page, per_page: 20 } }) });
  const action = useMutation({ mutationFn: ({ path, body }: { path: string; body: unknown }) => api.patch(path, body), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['lifestyle'] }); await refresh(); toast.success('Saved'); }, onError: (error) => toast.error('Could not save', error.message) });
  return <div className="space-y-6"><section className={panel}><h2 className="font-bold">Organization features</h2><p className="text-sm text-muted">Enabling a feature does not opt employees in. They control their own participation.</p>{workspace.isError ? <Failure retry={() => void workspace.refetch()} /> : !workspace.data ? <p>Loading controls…</p> : (['milestones_enabled', 'appreciation_enabled'] as const).map((key) => <label key={key} className="flex items-center gap-3"><input type="checkbox" checked={workspace.data.workspace.lifestyle?.[key] ?? false} disabled={action.isPending} onChange={(event) => action.mutate({ path: '/workspace/settings', body: { lifestyle: { [key]: event.target.checked } } })} />{key === 'milestones_enabled' ? 'Milestones' : 'Appreciation'}</label>)}</section><section className={panel}><h2 className="font-bold">Reported messages</h2><p className="text-sm text-muted">Only reported messages appear here. Unreported private conversations are not available to moderators.</p>{reports.isError ? <Failure retry={() => void reports.refetch()} /> : reports.isPending ? <p>Loading reports…</p> : !reports.data?.data.length ? <p>No reports awaiting review.</p> : reports.data.data.map((item) => <article className="space-y-3 rounded border border-border p-4" key={item.id}><p className="font-medium">{item.sender.name} → {item.recipient.name}</p><p className="whitespace-pre-wrap break-words">{item.message}</p>{item.reports?.map((report) => <p className="text-sm text-muted" key={report.id}>Reported: {report.reason}</p>)}<label className="block text-sm">Reason for removal<Textarea maxLength={500} value={reasons[item.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [item.id]: e.target.value })} /></label><Button disabled={!reasons[item.id]?.trim() || action.isPending} onClick={() => action.mutate({ path: `/lifestyle/appreciations/${item.id}/hide`, body: { reason: reasons[item.id].trim() } })}>Hide message</Button></article>)}<Pages page={page} last={reports.data?.last_page ?? 1} setPage={setPage} disabled={reports.isFetching} /></section></div>;
}
