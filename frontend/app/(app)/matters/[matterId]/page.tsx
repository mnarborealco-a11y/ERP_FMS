'use client';

import { use, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth, isApiError } from '@/lib/auth';
import { callApi, type RpcName } from '@/lib/apiClient';
import { useEmployees, employeeName } from '@/lib/useEmployees';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
  formatDateTime,
  isOverdue
} from '@/components/ui';
import type { ApprovalCycle, Matter, MatterGetResponse } from '@/types/api';

export default function MatterDetailPage({ params }: { params: Promise<{ matterId: string }> }) {
  const { matterId } = use(params);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: employees } = useEmployees();

  const { data, isLoading, error } = useQuery({
    queryKey: ['matters', 'get', matterId],
    queryFn: () => callApi<MatterGetResponse>('matter_detail', { p_matter_id: matterId })
  });

  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['matters'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  function useAction<TPayload extends Record<string, unknown>>(rpcName: RpcName) {
    return useMutation({
      mutationFn: (payload: TPayload) => callApi(rpcName, payload),
      onSuccess: () => {
        setActionError(null);
        setNotes('');
        invalidateAll();
      },
      onError: (err) => setActionError(isApiError(err) ? err.message : 'Something went wrong.')
    });
  }

  const completeStep1 = useAction<{ p_matter_id: string }>('matters_complete_step1');
  const completeStep2AndSubmit = useAction<{ p_matter_id: string; p_notes?: string }>('matters_complete_step2_and_submit');
  const sendForClientApproval = useAction<{ p_matter_id: string }>('matters_send_for_client_approval');
  const recordClientDecision = useAction<{ p_matter_id: string; p_cycle_id: string; p_decision: string; p_notes?: string }>(
    'matters_record_client_decision'
  );
  const submitToFounder = useAction<{ p_matter_id: string; p_notes?: string }>('matters_submit_to_founder');
  const sendForFiling = useAction<{ p_matter_id: string }>('matters_send_for_filing');
  const completeFiling = useAction<{ p_matter_id: string }>('matters_complete_filing');

  const [transferTo, setTransferTo] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const requestTransfer = useMutation({
    mutationFn: (payload: { p_matter_id: string; p_to_employee_id: string; p_reason: string }) =>
      callApi('matters_request_transfer', payload),
    onSuccess: () => {
      setActionError(null);
      setTransferTo('');
      setTransferReason('');
      invalidateAll();
    },
    onError: (err) => setActionError(isApiError(err) ? err.message : 'Something went wrong.')
  });

  if (isLoading || !data) return <LoadingState />;
  if (error) return <ErrorBanner message={isApiError(error) ? error.message : 'Failed to load matter.'} />;

  const { matter, steps, approvalCycles } = data;
  if (!matter) return <ErrorBanner message="Matter not found." />;

  const isAdmin = user?.role === 'FOUNDER_ADMIN';
  const isOwner = user?.role === 'EMPLOYEE' && matter.employee_id === user.userId;
  const activeStep = steps.find((s) => s.status === 'IN_PROGRESS' || s.status === 'PENDING' || s.status === 'BREACHED_OPEN');
  const pendingClientCycle = approvalCycles.find((c) => c.cycle_type === 'CLIENT_REVIEW' && c.decision === 'PENDING');
  const pendingTransfer = data.transferRequests.find((t) => t.status === 'PENDING');

  const anyMutationLoading =
    completeStep1.isPending ||
    completeStep2AndSubmit.isPending ||
    sendForClientApproval.isPending ||
    recordClientDecision.isPending ||
    submitToFounder.isPending ||
    sendForFiling.isPending ||
    completeFiling.isPending;

  return (
    <div>
      <PageHeader
        title={`${matter.matter_id} — ${matter.title}`}
        subtitle={`${matter.type === 'LITIGATION' ? 'Litigation' : 'Non-Litigation'} · Client: ${matter.client_name || '—'}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="slate">Assigned to {employeeName(employees, matter.employee_id)}</Badge>
              <Badge tone="blue">{matter.current_step.replaceAll('_', ' ')}</Badge>
              <Badge tone={matter.status === 'COMPLETED' ? 'green' : 'slate'}>{matter.status}</Badge>
              <Badge tone="purple">Founder iteration #{matter.founder_iteration_counter}</Badge>
              <Badge tone="purple">Client round #{matter.client_round_counter}</Badge>
            </div>

            {activeStep && (
              <div className={`mb-4 rounded-md border px-3 py-2 text-sm ${isOverdue(activeStep.due_at) ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                <span className="font-medium">{activeStep.step_type.replaceAll('_', ' ')}</span> — TAT {activeStep.tat_value} {activeStep.tat_unit.toLowerCase()}, due {formatDateTime(activeStep.due_at)}
                {isOverdue(activeStep.due_at) && <span className="ml-2 font-semibold">OVERDUE</span>}
              </div>
            )}

            {actionError && (
              <div className="mb-4">
                <ErrorBanner message={actionError} />
              </div>
            )}

            <ActionPanel
              matter={matter}
              isAdmin={isAdmin}
              isOwner={isOwner}
              notes={notes}
              setNotes={setNotes}
              pendingClientCycle={pendingClientCycle}
              disabled={anyMutationLoading}
              onCompleteStep1={() => completeStep1.mutate({ p_matter_id: matterId })}
              onCompleteStep2AndSubmit={() => completeStep2AndSubmit.mutate({ p_matter_id: matterId, p_notes: notes || undefined })}
              onSendForClientApproval={() => sendForClientApproval.mutate({ p_matter_id: matterId })}
              onRecordClientDecision={(decision) =>
                pendingClientCycle &&
                recordClientDecision.mutate({ p_matter_id: matterId, p_cycle_id: pendingClientCycle.cycle_id, p_decision: decision, p_notes: notes || undefined })
              }
              onSubmitToFounder={() => submitToFounder.mutate({ p_matter_id: matterId, p_notes: notes || undefined })}
              onSendForFiling={() => sendForFiling.mutate({ p_matter_id: matterId })}
              onCompleteFiling={() => completeFiling.mutate({ p_matter_id: matterId })}
            />
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Approval History</h2>
            {approvalCycles.length === 0 ? (
              <p className="text-sm text-slate-500">No approval cycles yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {approvalCycles
                  .slice()
                  .sort((a, b) => a.created_at.localeCompare(b.created_at))
                  .map((c) => (
                    <li key={c.cycle_id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={c.cycle_type === 'FOUNDER_REVIEW' ? 'purple' : 'blue'}>
                          {c.cycle_type === 'FOUNDER_REVIEW' ? `Founder review #${c.founder_iteration_number}` : `Client review (round ${c.client_round_number})`}
                        </Badge>
                        <Badge tone={c.decision === 'APPROVED' ? 'green' : c.decision === 'CHANGES_REQUESTED' ? 'red' : 'amber'}>{c.decision.replaceAll('_', ' ')}</Badge>
                        {c.scored_point && <Badge tone="red">+1 point</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Submitted {formatDateTime(c.submitted_at)}</div>
                      {c.decided_at && <div className="text-xs text-slate-500">Decided {formatDateTime(c.decided_at)}</div>}
                      {c.decision_notes && <div className="mt-1 text-slate-700">{c.decision_notes}</div>}
                    </li>
                  ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Steps</h2>
            <ul className="flex flex-col gap-2">
              {steps
                .slice()
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((s) => (
                  <li key={s.step_instance_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <span className="font-medium">{s.step_type.replaceAll('_', ' ')}</span>
                    <span className="text-slate-500">
                      TAT {s.tat_value} {s.tat_unit.toLowerCase()} · due {formatDateTime(s.due_at)}
                    </span>
                    <Badge tone={s.status.startsWith('BREACHED') ? 'red' : s.status === 'DONE' ? 'green' : 'slate'}>{s.status.replaceAll('_', ' ')}</Badge>
                  </li>
                ))}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Transfer</h2>
            {pendingTransfer ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Pending transfer to {employeeName(employees, pendingTransfer.to_employee_id)}
                {isAdmin && (
                  <div className="mt-1">
                    <Link href="/admin/approvals" className="font-medium underline">
                      Review in Approvals
                    </Link>
                  </div>
                )}
              </div>
            ) : isOwner && matter.status === 'IN_PROGRESS' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  requestTransfer.mutate({ p_matter_id: matterId, p_to_employee_id: transferTo, p_reason: transferReason });
                }}
                className="flex flex-col gap-3"
              >
                <Field label="Transfer to">
                  <Select required value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                    <option value="">Select employee…</option>
                    {employees
                      ?.filter((e) => e.userId !== matter.employee_id)
                      .map((e) => (
                        <option key={e.userId} value={e.userId}>
                          {e.name}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field label="Reason">
                  <Textarea required rows={2} value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
                </Field>
                <Button type="submit" variant="secondary" disabled={requestTransfer.isPending}>
                  Request Transfer (needs admin approval)
                </Button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">No pending transfer.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActionPanel({
  matter,
  isAdmin,
  isOwner,
  notes,
  setNotes,
  pendingClientCycle,
  disabled,
  onCompleteStep1,
  onCompleteStep2AndSubmit,
  onSendForClientApproval,
  onRecordClientDecision,
  onSubmitToFounder,
  onSendForFiling,
  onCompleteFiling
}: {
  matter: Matter;
  isAdmin: boolean;
  isOwner: boolean;
  notes: string;
  setNotes: (v: string) => void;
  pendingClientCycle?: ApprovalCycle;
  disabled: boolean;
  onCompleteStep1: () => void;
  onCompleteStep2AndSubmit: () => void;
  onSendForClientApproval: () => void;
  onRecordClientDecision: (decision: 'APPROVED' | 'CHANGES_REQUESTED') => void;
  onSubmitToFounder: () => void;
  onSendForFiling: () => void;
  onCompleteFiling: () => void;
}) {
  const step = matter.current_step;

  if (step === 'DRAFTING_STEP1') {
    if (!isOwner) return <PendingNote text="Employee is compiling the list of dates/notes (Step 1)." />;
    return (
      <Button onClick={onCompleteStep1} disabled={disabled}>
        Mark Step 1 Complete
      </Button>
    );
  }

  if (step === 'DRAFTING_STEP2') {
    if (!isOwner) return <PendingNote text="Employee is preparing the brief (Step 2)." />;
    return (
      <div className="flex flex-col gap-3">
        <Field label="Notes for founder (optional)">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button onClick={onCompleteStep2AndSubmit} disabled={disabled}>
          Complete Step 2 & Submit to Founder
        </Button>
      </div>
    );
  }

  if (step === 'AWAITING_FOUNDER_REVIEW') {
    if (!isAdmin) return <PendingNote text="Waiting for the Founder to review the draft." />;
    return (
      <p className="text-sm text-slate-600">
        Awaiting your review. Decide from{' '}
        <Link href="/admin/approvals" className="font-medium text-slate-900 underline">
          Approvals
        </Link>{' '}
        — every approval decision happens there.
      </p>
    );
  }

  if (step === 'REVISING_AFTER_FOUNDER_NOTES' || step === 'REVISING_AFTER_CLIENT_CHANGES') {
    if (!isOwner)
      return <PendingNote text={step === 'REVISING_AFTER_FOUNDER_NOTES' ? 'Employee is revising per founder notes.' : 'Employee is incorporating client-requested changes.'} />;
    return (
      <div className="flex flex-col gap-3">
        <Field label="Notes for founder (optional)">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button onClick={onSubmitToFounder} disabled={disabled}>
          Resubmit to Founder
        </Button>
      </div>
    );
  }

  if (step === 'READY_FOR_CLIENT_SEND') {
    if (!isOwner) return <PendingNote text="Founder approved. Waiting for employee to send it to the client." />;
    return (
      <Button onClick={onSendForClientApproval} disabled={disabled}>
        Send for Client Approval
      </Button>
    );
  }

  if (step === 'AWAITING_CLIENT_REVIEW') {
    if (!isOwner) return <PendingNote text="Waiting on the client's response." />;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">Record what the client said:</p>
        <Field label="Notes (required if requesting changes)">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button onClick={() => onRecordClientDecision('APPROVED')} disabled={disabled || !pendingClientCycle}>
            Client Approved
          </Button>
          <Button
            variant="danger"
            onClick={() => onRecordClientDecision('CHANGES_REQUESTED')}
            disabled={disabled || !pendingClientCycle || !notes.trim()}
            title={!notes.trim() ? 'Add a note explaining what the client wants changed first' : undefined}
          >
            Client Requested Changes
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'READY_FOR_FILING') {
    if (!isOwner) return <PendingNote text="Founder and client have both approved. Waiting for employee to send for filing." />;
    return (
      <Button onClick={onSendForFiling} disabled={disabled}>
        Send for Filing / Execution
      </Button>
    );
  }

  if (step === 'AWAITING_FILING_COMPLETION') {
    if (!isOwner) return <PendingNote text="Filing/execution is in progress." />;
    return (
      <Button onClick={onCompleteFiling} disabled={disabled}>
        Mark Filing Complete
      </Button>
    );
  }

  return <PendingNote text="This matter is completed." />;
}

function PendingNote({ text }: { text: string }) {
  return <p className="text-sm text-slate-500">{text}</p>;
}
