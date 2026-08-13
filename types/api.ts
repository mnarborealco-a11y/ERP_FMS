// Domain types, derived from the generated Supabase schema (types/supabase.ts)
// rather than hand-maintained in parallel. Field names match the Postgres
// column names (snake_case) returned by both direct table/view reads and the
// RPC functions' to_jsonb(row) responses.

import type { Database, Tables, Enums } from './supabase';

export type Role = Enums<'role_t'>;
export type UserStatus = Enums<'user_status_t'>;

export interface EmployeeSummary {
  userId: string;
  name: string;
}

export interface PublicUser {
  userId: string;
  name: string;
  email: string;
  role: Role;
  status?: UserStatus;
}

export type HolidayEntry = Tables<'holidays'>;
export type TatUnit = Enums<'tat_unit_t'>;
export type TatStepKey = 'STEP1' | 'STEP2' | 'CLIENT_APPROVAL' | 'FILING';
export type MatterTatSetting = Tables<'matter_tat_settings'>;

export type MatterType = Enums<'matter_type_t'>;
export type MatterStatus = Enums<'matter_status_t'>;
export type MatterStep = Enums<'matter_step_t'>;
export type Matter = Tables<'matters'>;

export type StepType = Enums<'step_type_t'>;
export type StepStatus = Enums<'step_status_t'>;
export type MatterStepInstance = Tables<'matter_steps'>;

export type CycleType = Enums<'cycle_type_t'>;
export type CycleDecision = Enums<'cycle_decision_t'>;
export type ApprovalCycle = Tables<'approval_cycles'>;

export type RequestStatus = Enums<'request_status_t'>;
export type TransferRequest = Tables<'transfer_requests'>;

export type CourtAppearance = Tables<'court_appearances'>;

export type TaskPriority = Enums<'task_priority_t'>;
export type TaskStatus = Enums<'task_status_t'>;
export type IndependentTask = Tables<'independent_tasks'>;

export type PushRequestStatus = Enums<'push_status_t'>;
export type TaskPushRequest = Tables<'task_push_requests'>;

export type ScoreEventType = Enums<'score_event_t'>;
export type ScoreRefType = Enums<'score_ref_t'>;
export type ScoreLedgerEntry = Tables<'score_ledger'>;

export interface ScoreSummaryRow {
  employeeId: string;
  name: string;
  totalPoints: number;
  byType: Partial<Record<ScoreEventType, number>>;
}

export interface AdminDashboard {
  mattersByStatus: Record<string, number>;
  pendingFounderDecisions: ApprovalCycle[];
  pendingTransfers: TransferRequest[];
  pendingTaskPushes: TaskPushRequest[];
  overdueSteps: MatterStepInstance[];
  overdueTasks: IndependentTask[];
}

export interface EmployeeDashboard {
  myMattersNeedingAction: Matter[];
  myOpenTasks: IndependentTask[];
  myPendingRequests: { transfers: TransferRequest[]; taskPushes: TaskPushRequest[] };
  myOverdueItems: { steps: MatterStepInstance[]; tasks: IndependentTask[] };
}

// RPC JSON return shapes (not auto-generated -- these are the ad hoc objects
// each RPC's `jsonb_build_object(...)` call returns).
export interface MatterMutationResponse {
  matter: Matter;
  step?: MatterStepInstance;
  cycle?: ApprovalCycle;
}
export interface MatterGetResponse {
  matter: Matter | null;
  steps: MatterStepInstance[];
  approvalCycles: ApprovalCycle[];
  transferRequests: TransferRequest[];
}
export interface TransferMutationResponse {
  transferRequest: TransferRequest;
  matter?: Matter;
}
export interface TaskMutationResponse {
  task: IndependentTask;
}
export interface TaskGetResponse {
  task: IndependentTask | null;
  pushRequests: TaskPushRequest[];
}
export interface PushRequestMutationResponse {
  pushRequest: TaskPushRequest;
  task?: IndependentTask;
}
export interface CourtAppearanceResponse {
  appearance: CourtAppearance;
}

export type { Database };
