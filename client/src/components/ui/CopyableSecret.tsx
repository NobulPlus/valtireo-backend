import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

/** A read-only value with a copy-to-clipboard action, for one-time secrets and invite links. */
export function CopyableSecret({ value, label = 'Copy' }: { value: string; label?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Copied', 'Copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-md border border-border bg-surface-soft px-3 py-2 text-sm font-mono text-strong">{value}</code>
      <Button type="button" variant="secondary" size="icon" onClick={handleCopy} title={label} aria-label={label}>
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
