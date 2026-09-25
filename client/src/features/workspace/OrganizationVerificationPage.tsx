import { useState } from 'react';
import { CheckCircle2, FileText, Send, Upload } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalSendAction } from '@/components/ui/ModalActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import {
  useOrganizationVerification,
  useSubmitOrganizationVerification,
  useUploadOrganizationVerificationDocument,
} from '@/features/workspace/api';
import { ApiError } from '@/lib/apiClient';
import { useDateFormatter } from '@/lib/dateFormat';
import type { OrganizationVerificationChecklistItem, OrganizationVerificationDocument } from '@/types/api';

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function verificationDocuments(
  documents: OrganizationVerificationDocument[] | { data?: OrganizationVerificationDocument[] } | undefined,
): OrganizationVerificationDocument[] {
  if (Array.isArray(documents)) return documents;
  return documents?.data ?? [];
}

export function OrganizationVerificationPage() {
  const toast = useToast();
  const { formatDate } = useDateFormatter();
  const verificationQuery = useOrganizationVerification();
  const uploadMutation = useUploadOrganizationVerificationDocument();
  const submitMutation = useSubmitOrganizationVerification();
  const [uploadingItem, setUploadingItem] = useState<OrganizationVerificationChecklistItem | null>(null);
  const [form, setForm] = useState({ title: '', notes: '' });
  const [file, setFile] = useState<File | null>(null);

  if (verificationQuery.isLoading) {
    return (
      <div>
        <PageHeader title="Organization verification" subtitle="Upload the documents Valtireo needs before activation." />
        <LoadingState label="Loading verification checklist..." fill />
      </div>
    );
  }

  if (verificationQuery.isError) {
    return (
      <div>
        <PageHeader title="Organization verification" subtitle="Upload the documents Valtireo needs before activation." />
        <ErrorState error={verificationQuery.error} onRetry={() => verificationQuery.refetch()} />
      </div>
    );
  }

  if (!verificationQuery.data) {
    return (
      <div>
        <PageHeader title="Organization verification" subtitle="Upload the documents Valtireo needs before activation." />
        <EmptyState title="Verification data is not available" />
      </div>
    );
  }

  const { verification, documents } = verificationQuery.data;
  const uploadedDocuments = verificationDocuments(documents);
  const requiredDone = verification.required_submitted >= verification.required_total;
  const canSubmit = verification.is_ready_for_review && !['pending_approval', 'active', 'suspended'].includes(verification.status);

  function openUpload(item: OrganizationVerificationChecklistItem) {
    setUploadingItem(item);
    setForm({ title: item.label, notes: '' });
    setFile(null);
  }

  async function submitUpload() {
    if (!uploadingItem || !file || !form.title.trim()) return;

    try {
      await uploadMutation.mutateAsync({
        document_type: uploadingItem.type,
        title: form.title,
        notes: form.notes || undefined,
        file,
      });
      toast.success('Document uploaded', `${uploadingItem.label} has been added to your verification pack.`);
      setUploadingItem(null);
      setFile(null);
    } catch (error) {
      toast.error('Could not upload document', actionError(error, 'Please check the file and try again.'));
    }
  }

  async function submitForReview() {
    try {
      const result = await submitMutation.mutateAsync();
      toast.success('Submitted for review', result.message);
    } catch (error) {
      toast.error('Could not submit verification', actionError(error, 'Upload all required documents first.'));
    }
  }

  return (
    <div>
      <PageHeader
        title="Organization verification"
        subtitle="Upload company evidence, submit for Valtireo review, and track approval readiness."
        status={<StatusBadge status={verification.is_verified ? 'verified' : verification.status} />}
        actions={
          <Button type="button" variant="primary" disabled={!canSubmit} isLoading={submitMutation.isPending} onClick={submitForReview}>
            <Send className="h-4 w-4" />
            Submit for review
          </Button>
        }
      />

      {!canSubmit && verification.status === 'pending_approval' && (
        <div className="mb-5">
          <Alert tone="info">Your documents have been submitted. Valtireo will review them and activate the organization when approved.</Alert>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs font-medium text-muted">Required submitted</p>
            <p className="mt-1 font-display text-2xl font-semibold text-strong">{verification.required_submitted}/{verification.required_total}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium text-muted">Required approved</p>
            <p className="mt-1 font-display text-2xl font-semibold text-strong">{verification.required_approved}/{verification.required_total}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium text-muted">Readiness</p>
            <p className="mt-1 font-display text-2xl font-semibold text-strong">{requiredDone ? 'Ready' : 'Open'}</p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Verification checklist</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {verification.checklist.map((item) => (
            <div key={item.type} className="rounded-lg border border-border bg-surface-soft p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {item.status === 'approved' ? <CheckCircle2 className="h-4 w-4 text-success" /> : <FileText className="h-4 w-4 text-muted" />}
                    <p className="font-medium text-strong">{item.label}</p>
                    {item.required && <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning">Required</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {item.submitted_at ? `Submitted ${formatDate(item.submitted_at)}` : 'No document uploaded yet'}
                    {item.reviewed_at ? ` · reviewed ${formatDate(item.reviewed_at)}` : ''}
                  </p>
                  {item.review_note && <p className="mt-2 text-xs leading-5 text-muted">Review note: {item.review_note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={item.status} />
                  <Button type="button" variant="secondary" size="sm" onClick={() => openUpload(item)}>
                    <Upload className="h-4 w-4" />
                    {item.document_id ? 'Replace' : 'Upload'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Uploaded documents</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {uploadedDocuments.length === 0 ? (
            <EmptyState title="No documents uploaded yet" />
          ) : (
            uploadedDocuments.map((document) => (
              <div key={document.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-strong">{document.title}</p>
                  <p className="text-xs text-muted">{document.document_type_label} · {document.file_name}</p>
                </div>
                <StatusBadge status={document.status} />
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Modal
        open={Boolean(uploadingItem)}
        onClose={() => setUploadingItem(null)}
        title={uploadingItem ? `Upload ${uploadingItem.label}` : 'Upload document'}
        footer={
          <>
            <ModalCancelAction onClick={() => setUploadingItem(null)} />
            <ModalSendAction title="Upload" disabled={!file || !form.title.trim()} isLoading={uploadMutation.isPending} onClick={submitUpload} />
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required>
            <Input value={form.title} disabled readOnly className="cursor-not-allowed bg-surface-soft text-muted" />
          </Field>
          <Field label="Document file" required>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-strong"
            />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
