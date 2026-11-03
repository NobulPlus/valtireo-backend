import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/States';
import { ApiError } from '@/lib/apiClient';
import { useOrbitPeople, type OrbitMember } from '@/features/orbit/api';

interface RoleOption {
  value: string;
  label: string;
}

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

export function OrbitMemberManager({
  members,
  isLoading,
  roleOptions,
  canManage,
  currentUserId,
  onAdd,
  onChangeRole,
  onRemove,
  isAdding,
  isRemoving,
}: {
  members: OrbitMember[];
  isLoading: boolean;
  roleOptions: RoleOption[];
  canManage: boolean;
  currentUserId: number | undefined;
  onAdd: (userId: number, role: string) => Promise<unknown>;
  onChangeRole: (userId: number, role: string) => Promise<unknown>;
  onRemove: (userId: number) => Promise<unknown>;
  isAdding: boolean;
  isRemoving: boolean;
}) {
  const [search, setSearch] = useState('');
  const [addRole, setAddRole] = useState(roleOptions[roleOptions.length - 1]?.value ?? roleOptions[0]?.value ?? '');
  const [error, setError] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);
  const people = useOrbitPeople(debouncedSearch);

  const existingIds = new Set(members.map((member) => member.id));
  const candidates = (people.data?.data ?? []).filter((person) => !existingIds.has(person.id));

  async function handleAdd(userId: number) {
    setError(null);
    try {
      await onAdd(userId, addRole);
      setSearch('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that member.');
    }
  }

  async function handleRemove(userId: number) {
    setError(null);
    try {
      await onRemove(userId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that member.');
    }
  }

  async function handleRoleChange(userId: number, role: string) {
    setError(null);
    try {
      await onChangeRole(userId, role);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update that member’s role.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      {isLoading ? (
        <LoadingState />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-strong">{member.name}</p>
                <p className="truncate text-xs text-muted">{member.email}</p>
              </div>
              {canManage ? (
                <div className="flex flex-shrink-0 items-center gap-2">
                  <SelectMenu
                    value={member.role}
                    onChange={(role) => void handleRoleChange(member.id, role)}
                    options={roleOptions}
                    className="w-36"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${member.name}`}
                    onClick={() => void handleRemove(member.id)}
                    disabled={isRemoving}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </div>
              ) : (
                <span className="flex-shrink-0 text-xs capitalize text-muted">
                  {member.role}{member.id === currentUserId ? ' · you' : ''}
                </span>
              )}
            </li>
          ))}
          {members.length === 0 && <li className="py-2.5 text-sm text-muted">No members yet.</li>}
        </ul>
      )}

      {canManage && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Add a member</p>
          <div className="flex items-center gap-2">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search colleagues" />
            <SelectMenu value={addRole} onChange={setAddRole} options={roleOptions} className="w-36" />
          </div>
          {search.trim() && (
            <ul className="flex flex-col gap-1">
              {candidates.map((person) => (
                <li key={person.id}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => void handleAdd(person.id)}
                    disabled={isAdding}
                  >
                    <span className="truncate text-left">{person.name}</span>
                    <Plus className="h-3.5 w-3.5 flex-shrink-0 text-pine" />
                  </Button>
                </li>
              ))}
              {!people.isLoading && candidates.length === 0 && (
                <li className="px-2 py-1 text-xs text-muted">No matching colleagues.</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
